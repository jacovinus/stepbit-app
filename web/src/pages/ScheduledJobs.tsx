import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlarmClock, Play, Plus, RefreshCw, TimerReset, Trash2, Workflow } from 'lucide-react';
import { cronApi, type CronJob } from '../api/cron';
import { useStepbitCore } from '../hooks/useStepbitCore';

const defaultPayload = `{
  "question": "Run scheduled analysis",
  "pipeline": {
    "name": "nightly_analysis",
    "stages": []
  }
}`;

const ScheduledJobs: React.FC = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [jobId, setJobId] = useState('');
  const [schedule, setSchedule] = useState('0 9 * * 1-5');
  const [executionType, setExecutionType] = useState('Pipeline');
  const [payload, setPayload] = useState(defaultPayload);
  const [maxRetries, setMaxRetries] = useState('3');
  const [backoffMs, setBackoffMs] = useState('300000');
  const { online, loading: statusLoading, refresh: refreshStatus } = useStepbitCore();

  useEffect(() => {
    void loadJobs();
  }, []);

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => a.id.localeCompare(b.id)),
    [jobs]
  );

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await cronApi.list();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load scheduled jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setFormError('');

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setFormError('Payload must be valid JSON.');
      return;
    }

    setSubmitting(true);
    try {
      await cronApi.create({
        id: jobId.trim(),
        schedule: schedule.trim(),
        execution_type: executionType,
        payload: parsedPayload,
        retry_policy: {
          max_retries: Number(maxRetries) || 0,
          backoff_ms: Number(backoffMs) || 0,
        },
      });

      setJobId('');
      setSchedule('0 9 * * 1-5');
      setExecutionType('Pipeline');
      setPayload(defaultPayload);
      setMaxRetries('3');
      setBackoffMs('300000');
      await loadJobs();
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to create scheduled job';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete scheduled job "${id}"?`)) return;

    try {
      await cronApi.delete(id);
      await loadJobs();
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete scheduled job.');
    }
  };

  const handleTrigger = async (id: string) => {
    try {
      await cronApi.trigger(id);
      await loadJobs();
    } catch (error) {
      console.error('Failed to trigger job:', error);
      alert('Failed to trigger scheduled job.');
    }
  };

  const formatUnixSeconds = (value: number | null) => {
    if (!value) return 'Never';
    return new Date(value * 1000).toLocaleString();
  };

  return (
    <div className="p-4 max-w-[1200px] mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xs bg-monokai-aqua/20 border border-monokai-aqua/30">
            <AlarmClock className="w-5 h-5 text-monokai-aqua" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gruv-light-0 tracking-tight">Scheduled Jobs</h1>
            <p className="text-xs text-gruv-light-4 font-medium">Program recurring pipeline and reasoning runs through stepbit-core</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-xs border glass ${online ? 'border-monokai-green/30 bg-monokai-green/5' : 'border-monokai-pink/30 bg-monokai-pink/5'}`}>
          <Workflow className={`w-4 h-4 ${online ? 'text-monokai-green animate-pulse' : 'text-monokai-pink'}`} />
          <span className={`text-xs font-semibold ${online ? 'text-monokai-green' : 'text-monokai-pink'}`}>
            stepbit-core: {online ? 'Connected' : 'Disconnected'}
          </span>
          <button
            onClick={refreshStatus}
            className="ml-2 p-1 hover:bg-white/10 rounded-xs transition-colors"
            disabled={statusLoading}
          >
            <RefreshCw className={`w-3 h-3 text-gruv-light-4 ${statusLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        <section className="glass border-white/10 rounded-xs p-4 flex-1 min-w-[320px] xl:max-w-[420px]">
          <div className="flex items-center gap-2.5 mb-4">
            <Plus className="w-4 h-4 text-monokai-orange" />
            <h2 className="text-lg font-semibold text-gruv-light-1">New Scheduled Job</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">Job ID</label>
              <input
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="nightly_analysis"
                className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">Cron Schedule</label>
              <input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="0 9 * * 1-5"
                className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1"
              />
              <p className="text-xs text-gruv-light-4 mt-1.5">Uses standard cron syntax as expected by stepbit-core.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">Execution Type</label>
              <select
                value={executionType}
                onChange={(e) => setExecutionType(e.target.value)}
                className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1"
              >
                <option value="Pipeline">Pipeline</option>
                <option value="ReasoningGraph">ReasoningGraph</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">Max Retries</label>
                <input
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">Backoff (ms)</label>
                <input
                  value={backoffMs}
                  onChange={(e) => setBackoffMs(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">Payload JSON</label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={12}
                className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-monokai-green font-mono"
              />
            </div>

            {formError && (
              <div className="rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 px-3 py-2.5 text-sm text-monokai-pink">
                {formError}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={submitting || !online}
              className="w-full flex items-center justify-center gap-2 bg-monokai-aqua text-gruv-dark-0 px-4 py-2.5 rounded-xs text-sm font-medium border border-monokai-aqua/70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Creating...' : 'Create Scheduled Job'}
            </button>
          </div>
        </section>

        <section className="glass border-white/10 rounded-xs p-4 flex-[1.4] min-w-[320px]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gruv-light-1">Registered Jobs</h2>
              <p className="text-xs text-gruv-light-4">View current schedules, recent execution metadata, and manual triggers.</p>
            </div>
            <button
              onClick={() => void loadJobs()}
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
          ) : sortedJobs.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-xs">
              <TimerReset className="w-8 h-8 text-gruv-light-4 mx-auto mb-3" />
              <p className="text-sm text-gruv-light-3 font-semibold">No scheduled jobs yet</p>
              <p className="text-xs text-gruv-light-4 mt-1.5">Create one from the panel on the left to start automating runs.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedJobs.map((job, index) => (
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
                        <Stat label="Last Run" value={formatUnixSeconds(job.last_run_at)} />
                        <Stat label="Next Retry" value={formatUnixSeconds(job.next_retry_at)} />
                        <Stat label="Failures" value={String(job.failure_count)} />
                      </div>

                      <details className="rounded-xs border border-white/10 bg-gruv-dark-0/70">
                        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-gruv-light-3">
                          View Payload
                        </summary>
                        <pre className="px-3 pb-3 text-sm text-monokai-green overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(job.payload, null, 2)}
                        </pre>
                      </details>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => void handleTrigger(job.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xs text-sm font-medium bg-monokai-green/15 text-monokai-green border border-monokai-green/20 hover:bg-monokai-green/20 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Run now
                      </button>
                      <button
                        onClick={() => void handleDelete(job.id)}
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
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-4 py-3">
    <p className="text-xs uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
    <p className="mt-2 text-sm font-medium text-gruv-light-1 break-words">{value}</p>
  </div>
);

export default ScheduledJobs;
