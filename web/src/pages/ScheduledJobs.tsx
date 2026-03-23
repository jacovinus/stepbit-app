import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlarmClock, History, Play, Plus, RefreshCw, Search, TimerReset, Trash2, Workflow } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { cronApi, type CreateCronJobRequest, type CronJob } from '../api/cron';
import { executionsApi, type ExecutionRun } from '../api/executions';
import { getCoreCronStatus } from '../api/llm';
import { useStepbitCore } from '../hooks/useStepbitCore';
import { useAppDialog } from '../components/ui/AppDialogProvider';
import type { CoreCronStatus } from '../types';
import { toast } from 'sonner';

type ExecutionType = 'Pipeline' | 'ReasoningGraph';

const EXECUTION_TYPE_OPTIONS: ExecutionType[] = ['Pipeline', 'ReasoningGraph'];
const DEFAULT_SCHEDULE = '0 9 * * 1-5';
const DEFAULT_JOB_QUESTION = 'Run scheduled analysis';
const DEFAULT_TARGET_NAME = 'nightly_analysis';
const DEFAULT_MAX_RETRIES = '3';
const DEFAULT_BACKOFF_MS = '300000';

const ScheduledJobs: React.FC = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [jobId, setJobId] = useState('');
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [executionType, setExecutionType] = useState<ExecutionType>('Pipeline');
  const [jobQuestion, setJobQuestion] = useState(DEFAULT_JOB_QUESTION);
  const [targetName, setTargetName] = useState(DEFAULT_TARGET_NAME);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [payload, setPayload] = useState('');
  const [maxRetries, setMaxRetries] = useState(DEFAULT_MAX_RETRIES);
  const [backoffMs, setBackoffMs] = useState(DEFAULT_BACKOFF_MS);
  const [jobActivity, setJobActivity] = useState<ExecutionRun[]>([]);
  const [activityQuery, setActivityQuery] = useState('');
  const { online, loading: statusLoading, refresh: refreshStatus } = useStepbitCore();
  const dialog = useAppDialog();
  const { data: cronStatus, isLoading: cronStatusLoading, refetch: refetchCronStatus } = useQuery({
    queryKey: ['scheduled-jobs-core-cron-status'],
    queryFn: () => getCoreCronStatus(),
    refetchInterval: 10000,
    retry: false,
  });

  useEffect(() => {
    void Promise.all([loadJobs(), loadJobActivity()]);
  }, []);

  const generatedPayload = useMemo(
    () => buildGuidedPayload({
      executionType,
      question: jobQuestion,
      targetName,
      jobId,
    }),
    [executionType, jobQuestion, targetName, jobId],
  );

  const payloadPreview = useMemo(
    () => advancedMode ? safeParseJson(payload) : { success: true as const, value: generatedPayload },
    [advancedMode, payload, generatedPayload],
  );

  const validation = useMemo(
    () => validateScheduledJob({
      jobId,
      schedule,
      executionType,
      jobQuestion,
      targetName,
      maxRetries,
      backoffMs,
      advancedMode,
      payloadPreview,
    }),
    [jobId, schedule, executionType, jobQuestion, targetName, maxRetries, backoffMs, advancedMode, payloadPreview],
  );

  const sortedJobs = useMemo(
    () => [...jobs].sort((left, right) => left.id.localeCompare(right.id)),
    [jobs],
  );

  const filteredActivity = useMemo(
    () => jobActivity.filter((run) => {
      const haystack = [
        run.source_id,
        run.action_type,
        run.status,
        run.error ?? '',
        JSON.stringify(run.request_payload ?? {}),
      ].join(' ').toLowerCase();
      return activityQuery.trim() === '' || haystack.includes(activityQuery.toLowerCase());
    }),
    [jobActivity, activityQuery],
  );

  const activitySummary = useMemo(() => {
    const completed = filteredActivity.filter((run) => run.status === 'completed').length;
    const failed = filteredActivity.filter((run) => run.status === 'failed').length;
    return {
      visible: filteredActivity.length,
      completed,
      failed,
    };
  }, [filteredActivity]);

  async function loadJobs() {
    setLoading(true);
    try {
      const data = await cronApi.list();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load scheduled jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadJobActivity() {
    try {
      const data = await executionsApi.list(30, 0);
      setJobActivity(data.filter((run) => run.source_type === 'cron_job'));
    } catch (error) {
      console.error('Failed to load scheduled job activity:', error);
    }
  }

  async function handleCreate() {
    setFormError('');

    if (!validation.valid) {
      setFormError(validation.messages[0] ?? 'Scheduled job configuration is invalid.');
      return;
    }

    if (!payloadPreview.success) {
      setFormError('Payload must be valid JSON.');
      return;
    }

    const request: CreateCronJobRequest = {
      id: jobId.trim(),
      schedule: schedule.trim(),
      execution_type: executionType,
      payload: payloadPreview.value,
      retry_policy: {
        max_retries: Number(maxRetries) || 0,
        backoff_ms: Number(backoffMs) || 0,
      },
    };

    setSubmitting(true);
    try {
      await cronApi.create(request);
      resetForm();
      await Promise.all([loadJobs(), loadJobActivity()]);
      toast.success('Scheduled job created.');
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to create scheduled job';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await dialog.confirm({
      title: 'Delete scheduled job',
      description: `Scheduled job "${id}" will be removed from the scheduler.`,
      confirmLabel: 'Delete Job',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await cronApi.delete(id);
      await Promise.all([loadJobs(), loadJobActivity()]);
      toast.success(`Scheduled job "${id}" deleted.`);
    } catch (error) {
      console.error('Failed to delete job:', error);
      await dialog.alert({
        title: 'Delete failed',
        description: 'The scheduled job could not be deleted.',
        tone: 'danger',
      });
    }
  }

  async function handleTrigger(id: string) {
    try {
      await cronApi.trigger(id);
      await Promise.all([loadJobs(), loadJobActivity()]);
      toast.success(`Scheduled job "${id}" triggered.`);
    } catch (error) {
      console.error('Failed to trigger job:', error);
      await dialog.alert({
        title: 'Trigger failed',
        description: 'The scheduled job could not be triggered.',
        tone: 'danger',
      });
    }
  }

  function resetForm() {
    setJobId('');
    setSchedule(DEFAULT_SCHEDULE);
    setExecutionType('Pipeline');
    setJobQuestion(DEFAULT_JOB_QUESTION);
    setTargetName(DEFAULT_TARGET_NAME);
    setAdvancedMode(false);
    setPayload('');
    setMaxRetries(DEFAULT_MAX_RETRIES);
    setBackoffMs(DEFAULT_BACKOFF_MS);
    setFormError('');
  }

  return (
    <div className="p-4 max-w-[1200px] mx-auto min-h-screen">
      <ScheduledJobsHeader
        online={online}
        statusLoading={statusLoading}
        onRefresh={refreshStatus}
      />

      <CoreSchedulerPanel
        cronStatus={cronStatus}
        loading={cronStatusLoading}
        onRefresh={() => void refetchCronStatus()}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4 mb-4">
        <ScheduledJobBuilderCard
          jobId={jobId}
          schedule={schedule}
          executionType={executionType}
          jobQuestion={jobQuestion}
          targetName={targetName}
          advancedMode={advancedMode}
          payload={payload}
          maxRetries={maxRetries}
          backoffMs={backoffMs}
          generatedPayload={generatedPayload}
          payloadPreview={payloadPreview}
          validation={validation}
          formError={formError}
          online={online}
          submitting={submitting}
          onJobIdChange={setJobId}
          onScheduleChange={setSchedule}
          onExecutionTypeChange={setExecutionType}
          onQuestionChange={setJobQuestion}
          onTargetNameChange={setTargetName}
          onAdvancedModeToggle={() => setAdvancedMode((value) => !value)}
          onPayloadChange={setPayload}
          onMaxRetriesChange={setMaxRetries}
          onBackoffChange={setBackoffMs}
          onSubmit={() => void handleCreate()}
        />

        <RegisteredJobsCard
          jobs={sortedJobs}
          loading={loading}
          onRefresh={() => void loadJobs()}
          onTrigger={(id) => void handleTrigger(id)}
          onDelete={(id) => void handleDelete(id)}
        />
      </div>

      <JobActivityCard
        runs={filteredActivity}
        summary={activitySummary}
        query={activityQuery}
        onQueryChange={setActivityQuery}
        onRefresh={() => void loadJobActivity()}
      />
    </div>
  );
};

function ScheduledJobsHeader({
  online,
  statusLoading,
  onRefresh,
}: {
  online: boolean;
  statusLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-xs bg-monokai-aqua/20 border border-monokai-aqua/30">
          <AlarmClock className="w-5 h-5 text-monokai-aqua" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gruv-light-0 tracking-tight">Scheduled Jobs</h1>
          <p className="text-xs text-gruv-light-4 font-medium">Program recurring pipeline and reasoning runs through stepbit-core.</p>
        </div>
      </div>

      <div className={`flex items-center gap-2 px-3 py-2 rounded-xs border glass ${online ? 'border-monokai-green/30 bg-monokai-green/5' : 'border-monokai-pink/30 bg-monokai-pink/5'}`}>
        <Workflow className={`w-4 h-4 ${online ? 'text-monokai-green animate-pulse' : 'text-monokai-pink'}`} />
        <span className={`text-xs font-semibold ${online ? 'text-monokai-green' : 'text-monokai-pink'}`}>
          stepbit-core: {online ? 'Connected' : 'Disconnected'}
        </span>
        <button
          onClick={onRefresh}
          className="ml-2 p-1 hover:bg-white/10 rounded-xs transition-colors"
          disabled={statusLoading}
        >
          <RefreshCw className={`w-3 h-3 text-gruv-light-4 ${statusLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function CoreSchedulerPanel({
  cronStatus,
  loading,
  onRefresh,
}: {
  cronStatus?: CoreCronStatus;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="glass border-white/10 rounded-xs p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gruv-light-1">Core Scheduler Runtime</h2>
          <p className="text-xs text-gruv-light-4">Live scheduler state from stepbit-core. Use this to confirm the cron worker is actually running, beyond the local activity feed.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/system"
            className="px-3 py-2 rounded-xs bg-white/5 hover:bg-white/10 transition-colors text-xs font-semibold text-gruv-light-2"
          >
            Open System View
          </Link>
          <button
            onClick={onRefresh}
            className="p-2 rounded-xs bg-white/5 hover:bg-white/10 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gruv-light-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !cronStatus ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="h-20 rounded-xs bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : !cronStatus ? (
        <EmptyState
          icon={Workflow}
          title="No scheduler telemetry available"
          description="stepbit-core did not return live cron status for this view."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <InfoStat
            label="Scheduler"
            value={cronStatus.scheduler_running ? 'Running' : 'Stopped'}
          />
          <InfoStat label="Registered Jobs" value={String(cronStatus.total_jobs)} />
          <InfoStat label="Failing Jobs" value={String(cronStatus.failing_jobs)} />
          <InfoStat label="Retry Queue" value={String(cronStatus.retrying_jobs)} />
        </div>
      )}
    </section>
  );
}

function ScheduledJobBuilderCard(props: {
  jobId: string;
  schedule: string;
  executionType: ExecutionType;
  jobQuestion: string;
  targetName: string;
  advancedMode: boolean;
  payload: string;
  maxRetries: string;
  backoffMs: string;
  generatedPayload: unknown;
  payloadPreview: ParseResult;
  validation: ValidationResult;
  formError: string;
  online: boolean;
  submitting: boolean;
  onJobIdChange: (value: string) => void;
  onScheduleChange: (value: string) => void;
  onExecutionTypeChange: (value: ExecutionType) => void;
  onQuestionChange: (value: string) => void;
  onTargetNameChange: (value: string) => void;
  onAdvancedModeToggle: () => void;
  onPayloadChange: (value: string) => void;
  onMaxRetriesChange: (value: string) => void;
  onBackoffChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const {
    jobId,
    schedule,
    executionType,
    jobQuestion,
    targetName,
    advancedMode,
    payload,
    maxRetries,
    backoffMs,
    generatedPayload,
    payloadPreview,
    validation,
    formError,
    online,
    submitting,
    onJobIdChange,
    onScheduleChange,
    onExecutionTypeChange,
    onQuestionChange,
    onTargetNameChange,
    onAdvancedModeToggle,
    onPayloadChange,
    onMaxRetriesChange,
    onBackoffChange,
    onSubmit,
  } = props;

  return (
    <section className="glass border-white/10 rounded-xs p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <Plus className="w-4 h-4 text-monokai-orange" />
        <h2 className="text-lg font-semibold text-gruv-light-1">New Scheduled Job</h2>
      </div>

      <div className="space-y-4">
        <Field label="Job ID" value={jobId} onChange={onJobIdChange} placeholder="nightly_analysis" />
        <Field label="Cron Schedule" value={schedule} onChange={onScheduleChange} placeholder="0 9 * * 1-5" />
        <p className="text-xs text-gruv-light-4 -mt-2">Uses standard five-field cron syntax as expected by stepbit-core.</p>

        <div>
          <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">Execution Type</label>
          <select
            value={executionType}
            onChange={(event) => onExecutionTypeChange(event.target.value as ExecutionType)}
            className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1"
          >
            {EXECUTION_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <p className="text-xs text-gruv-light-4 mt-1.5">Goal scheduling remains app-managed until stepbit-core exposes a dedicated goal execution contract.</p>
        </div>

        <TextAreaField label="Prompt / Question" value={jobQuestion} onChange={onQuestionChange} rows={3} />
        <Field
          label={executionType === 'Pipeline' ? 'Pipeline Name' : 'Graph Label'}
          value={targetName}
          onChange={onTargetNameChange}
          placeholder={executionType === 'Pipeline' ? 'nightly_analysis' : 'daily_reasoning_graph'}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max Retries" value={maxRetries} onChange={onMaxRetriesChange} placeholder="3" inputMode="numeric" />
          <Field label="Backoff (ms)" value={backoffMs} onChange={onBackoffChange} placeholder="300000" inputMode="numeric" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InfoStat label="Schedule Summary" value={describeSchedule(schedule)} />
          <InfoStat label="Retry Summary" value={describeRetryPolicy(maxRetries, backoffMs)} />
        </div>

        <ToggleCard
          title="Advanced Payload JSON"
          description="Stay in guided mode by default; switch only when you need full control over the payload."
          active={advancedMode}
          toneClassName="bg-monokai-orange"
          onToggle={onAdvancedModeToggle}
        />

        {advancedMode ? (
          <TextAreaField
            label="Payload JSON"
            value={payload}
            onChange={onPayloadChange}
            rows={12}
            mono
          />
        ) : (
          <JsonPreviewCard label="Generated Payload Preview" value={generatedPayload} />
        )}

        <ValidationPanel validation={validation} />

        {payloadPreview.success && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoStat label="Payload Summary" value={summarizePayload(payloadPreview.value)} />
            <InfoStat label="Execution Shape" value={executionType === 'Pipeline' ? 'Pipeline execution payload' : 'Reasoning graph payload'} />
          </div>
        )}

        {formError && <ErrorBox message={formError} />}

        <button
          onClick={onSubmit}
          disabled={submitting || !online}
          className="w-full flex items-center justify-center gap-2 bg-monokai-aqua text-gruv-dark-0 px-4 py-2.5 rounded-xs text-sm font-medium border border-monokai-aqua/70 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {submitting ? 'Creating...' : 'Create Scheduled Job'}
        </button>
      </div>
    </section>
  );
}

function RegisteredJobsCard({
  jobs,
  loading,
  onRefresh,
  onTrigger,
  onDelete,
}: {
  jobs: CronJob[];
  loading: boolean;
  onRefresh: () => void;
  onTrigger: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="glass border-white/10 rounded-xs p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gruv-light-1">Registered Jobs</h2>
          <p className="text-xs text-gruv-light-4">View current schedules, retry behavior, recent execution metadata, and manual triggers.</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xs bg-white/5 hover:bg-white/10 transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gruv-light-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="h-24 rounded-xs bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={TimerReset}
          title="No scheduled jobs yet"
          description="Create one from the builder to start automating recurring runs."
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-xs border border-white/10 bg-white/5 p-3.5"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gruv-light-1 break-all">{job.id}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-orange/15 text-monokai-orange border border-monokai-orange/20">
                      {job.execution_type}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gruv-dark-0 text-gruv-light-3 border border-white/10">
                      {job.schedule}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <InfoStat label="Last Run" value={formatUnixSeconds(job.last_run_at)} />
                    <InfoStat label="Next Retry" value={formatUnixSeconds(job.next_retry_at)} />
                    <InfoStat label="Failures" value={String(job.failure_count)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <InfoStat label="Retry Policy" value={formatRetryPolicy(job.retry_policy)} />
                    <InfoStat label="Payload Summary" value={summarizePayload(job.payload)} />
                  </div>

                  <JsonPreviewCard label="View Payload" value={job.payload} />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onTrigger(job.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xs text-sm font-medium bg-monokai-green/15 text-monokai-green border border-monokai-green/20 hover:bg-monokai-green/20 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Run now
                  </button>
                  <button
                    onClick={() => onDelete(job.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xs text-sm font-medium bg-monokai-pink/15 text-monokai-pink border border-monokai-pink/20 hover:bg-monokai-pink/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

function JobActivityCard({
  runs,
  summary,
  query,
  onQueryChange,
  onRefresh,
}: {
  runs: ExecutionRun[];
  summary: { visible: number; completed: number; failed: number };
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="glass border-white/10 rounded-xs p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gruv-light-1">Job Activity Feed</h2>
          <p className="text-xs text-gruv-light-4">Local execution history for create, delete, and manual trigger actions tied to scheduled jobs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/executions"
            className="px-3 py-2 rounded-xs bg-white/5 hover:bg-white/10 transition-colors text-xs font-semibold text-gruv-light-2"
          >
            Open Execution History
          </Link>
          <button
            onClick={onRefresh}
            className="p-2 rounded-xs bg-white/5 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gruv-light-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <InfoStat label="Visible Runs" value={String(summary.visible)} />
        <InfoStat label="Completed" value={String(summary.completed)} />
        <InfoStat label="Failed" value={String(summary.failed)} />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gruv-light-4" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter by job id, action, payload or error..."
          className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 pl-9 pr-3 py-2.5 text-sm text-gruv-light-1"
        />
      </div>

      {runs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No scheduled job activity yet"
          description="Create, trigger, or delete a job to inspect the local operational feed."
        />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="rounded-xs border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gruv-light-1">{run.action_type}</p>
                  <p className="text-[11px] text-gruv-light-4">{run.source_id}</p>
                  <p className="text-[11px] text-gruv-light-3 mt-2">{summarizePayload(run.request_payload)}</p>
                </div>
                <div className="text-right">
                  <RunStatusBadge status={run.status} />
                  <p className="mt-1 text-[11px] text-gruv-light-3">{new Date(run.created_at).toLocaleString()}</p>
                </div>
              </div>
              {run.error && <p className="mt-2 text-xs text-monokai-pink whitespace-pre-wrap">{run.error}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ValidationPanel({ validation }: { validation: ValidationResult }) {
  return (
    <div className={`rounded-xs border p-3 ${validation.valid ? 'border-monokai-green/20 bg-monokai-green/10' : 'border-monokai-orange/20 bg-monokai-orange/10'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gruv-light-2">Builder Validation</p>
      <div className="mt-2 space-y-1">
        {validation.messages.map((message) => (
          <p key={message} className="text-xs text-gruv-light-2">{message}</p>
        ))}
      </div>
    </div>
  );
}

function ToggleCard({
  title,
  description,
  active,
  toneClassName,
  onToggle,
}: {
  title: string;
  description: string;
  active: boolean;
  toneClassName: string;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 p-3 rounded-xs bg-black/20 border border-white/5">
      <div>
        <div className="text-xs font-semibold text-gruv-light-1">{title}</div>
        <div className="text-[11px] text-gruv-light-4">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative w-12 h-7 rounded-xs transition-colors ${active ? toneClassName : 'bg-gruv-dark-4'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-xs bg-white transition-transform ${active ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm ${mono ? 'text-monokai-green font-mono' : 'text-gruv-light-1'}`}
      />
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
      <p className="mt-2 text-sm font-medium text-gruv-light-1 break-words">{value}</p>
    </div>
  );
}

function JsonPreviewCard({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="rounded-xs border border-white/10 bg-gruv-dark-0/70">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-gruv-light-3">{label}</summary>
      <pre className="px-3 pb-3 text-sm text-monokai-green overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 px-3 py-2.5 text-sm text-monokai-pink">
      {message}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-16 border border-dashed border-white/10 rounded-xs">
      <Icon className="w-8 h-8 text-gruv-light-4 mx-auto mb-3" />
      <p className="text-sm text-gruv-light-3 font-semibold">{title}</p>
      <p className="text-xs text-gruv-light-4 mt-1.5">{description}</p>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-monokai-green/15 text-monokai-green border-monokai-green/20">completed</span>;
  }
  if (status === 'failed') {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-monokai-pink/15 text-monokai-pink border-monokai-pink/20">failed</span>;
  }
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-monokai-orange/15 text-monokai-orange border-monokai-orange/20">running</span>;
}

type ValidationResult = {
  valid: boolean;
  messages: string[];
};

type ParseResult =
  | { success: true; value: any }
  | { success: false };

function validateScheduledJob(input: {
  jobId: string;
  schedule: string;
  executionType: ExecutionType;
  jobQuestion: string;
  targetName: string;
  maxRetries: string;
  backoffMs: string;
  advancedMode: boolean;
  payloadPreview: ParseResult;
}): ValidationResult {
  const messages: string[] = [];

  if (input.jobId.trim() === '') {
    messages.push('Job ID is required.');
  }
  if (input.schedule.trim().split(/\s+/).length !== 5) {
    messages.push('Cron schedule must contain exactly five fields.');
  }
  if (input.jobQuestion.trim() === '') {
    messages.push('Prompt / question is required.');
  }
  if (input.targetName.trim() === '') {
    messages.push(input.executionType === 'Pipeline' ? 'Pipeline name is required.' : 'Graph label is required.');
  }
  if (!isNonNegativeInteger(input.maxRetries)) {
    messages.push('Max retries must be a non-negative integer.');
  }
  if (!isNonNegativeInteger(input.backoffMs)) {
    messages.push('Backoff must be a non-negative integer.');
  }
  if (input.advancedMode && !input.payloadPreview.success) {
    messages.push('Payload JSON must parse successfully.');
  }

  if (messages.length === 0) {
    messages.push('Scheduled job looks valid and ready to register.');
  }

  return {
    valid: messages.length === 1 && messages[0] === 'Scheduled job looks valid and ready to register.',
    messages,
  };
}

function buildGuidedPayload(input: {
  executionType: ExecutionType;
  question: string;
  targetName: string;
  jobId: string;
}) {
  if (input.executionType === 'Pipeline') {
    return {
      question: input.question.trim(),
      pipeline: {
        name: input.targetName.trim() || input.jobId.trim() || 'scheduled_pipeline',
        stages: [],
      },
    };
  }

  return {
    question: input.question.trim(),
    graph_label: input.targetName.trim() || input.jobId.trim() || 'scheduled_reasoning_graph',
    nodes: {},
    edges: [],
  };
}

function describeSchedule(schedule: string) {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    return 'Invalid cron expression';
  }
  return `Minute ${parts[0]}, hour ${parts[1]}, day ${parts[2]}, month ${parts[3]}, weekday ${parts[4]}`;
}

function describeRetryPolicy(maxRetries: string, backoffMs: string) {
  const retries = Number(maxRetries) || 0;
  const backoff = Number(backoffMs) || 0;
  return `${retries} retries with ${formatMilliseconds(backoff)} backoff`;
}

function formatRetryPolicy(retryPolicy: CronJob['retry_policy']) {
  if (!retryPolicy) return 'Default';
  return `${retryPolicy.max_retries} retries / ${formatMilliseconds(retryPolicy.backoff_ms)}`;
}

function formatMilliseconds(value: number) {
  if (value < 1000) return `${value} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)} s`;
  return `${(value / 60_000).toFixed(1)} min`;
}

function formatUnixSeconds(value: number | null) {
  if (!value) return 'Never';
  return new Date(value * 1000).toLocaleString();
}

function summarizePayload(payload: any) {
  if (!payload || typeof payload !== 'object') return 'No payload';
  if (payload.pipeline?.name) return `Pipeline ${payload.pipeline.name}`;
  if (payload.graph_label) return `Graph ${payload.graph_label}`;
  if (payload.question) return payload.question;
  if (payload.nodes && payload.edges) return 'Reasoning graph payload';
  return 'Custom payload';
}

function safeParseJson(input: string): ParseResult {
  try {
    return { success: true, value: JSON.parse(input) };
  } catch {
    return { success: false };
  }
}

function isNonNegativeInteger(value: string) {
  return /^\d+$/.test(value.trim());
}

export default ScheduledJobs;
