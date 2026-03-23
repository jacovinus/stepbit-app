import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, BellRing, CheckCircle2, Plus, RefreshCw, Search, Send, Trash2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { eventsApi, type EventTrigger } from '../api/events';
import { executionsApi, type ExecutionRun } from '../api/executions';
import { getCoreRecentEvents, getCoreSystemRuntime } from '../api/llm';
import { useStepbitCore } from '../hooks/useStepbitCore';
import { useAppDialog } from '../components/ui/AppDialogProvider';
import type { CoreRecentEvent, CoreSystemRuntime } from '../types';
import { toast } from 'sonner';

type ActionMode = 'Goal' | 'Pipeline';
type ActivityFilter = 'all' | 'event' | 'trigger';

const ACTION_MODE_OPTIONS: ActionMode[] = ['Goal', 'Pipeline'];
const ACTIVITY_FILTER_OPTIONS: ActivityFilter[] = ['all', 'trigger', 'event'];
const DEFAULT_EVENT_TYPE = 'file.created';
const DEFAULT_TRIGGER_ID = 'file-processor';
const DEFAULT_CONDITION_PATH = 'extension';
const DEFAULT_CONDITION_VALUE = '.pdf';
const DEFAULT_GOAL_TARGET = 'Inspect the new PDF and summarize it';
const DEFAULT_EVENT_PAYLOAD = '{\n  "extension": ".pdf",\n  "path": "/tmp/report.pdf"\n}';

const Triggers: React.FC = () => {
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [activity, setActivity] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingTrigger, setSubmittingTrigger] = useState(false);
  const [publishingEvent, setPublishingEvent] = useState(false);
  const [triggerError, setTriggerError] = useState('');
  const [eventError, setEventError] = useState('');
  const [eventType, setEventType] = useState(DEFAULT_EVENT_TYPE);
  const [triggerId, setTriggerId] = useState(DEFAULT_TRIGGER_ID);
  const [conditionPath, setConditionPath] = useState(DEFAULT_CONDITION_PATH);
  const [conditionValue, setConditionValue] = useState(DEFAULT_CONDITION_VALUE);
  const [actionMode, setActionMode] = useState<ActionMode>('Goal');
  const [actionTarget, setActionTarget] = useState(DEFAULT_GOAL_TARGET);
  const [advancedTriggerMode, setAdvancedTriggerMode] = useState(false);
  const [condition, setCondition] = useState('');
  const [action, setAction] = useState('');
  const [publishEventType, setPublishEventType] = useState(DEFAULT_EVENT_TYPE);
  const [publishPayload, setPublishPayload] = useState(DEFAULT_EVENT_PAYLOAD);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [activityQuery, setActivityQuery] = useState('');
  const { online, loading: statusLoading, refresh: refreshStatus } = useStepbitCore();
  const dialog = useAppDialog();
  const { data: recentEvents, isLoading: recentEventsLoading, refetch: refetchRecentEvents } = useQuery({
    queryKey: ['triggers-recent-core-events'],
    queryFn: () => getCoreRecentEvents(8),
    refetchInterval: 10000,
    retry: false,
  });
  const { data: systemRuntime, isLoading: runtimeLoading, refetch: refetchRuntime } = useQuery({
    queryKey: ['triggers-system-runtime'],
    queryFn: () => getCoreSystemRuntime(),
    refetchInterval: 10000,
    retry: false,
  });

  useEffect(() => {
    void loadTriggers();
    void loadActivity();
  }, []);

  const sortedTriggers = useMemo(
    () => [...triggers].sort((left, right) => left.id.localeCompare(right.id)),
    [triggers],
  );

  const previewCondition = useMemo(
    () => ({
      Equals: {
        path: conditionPath.trim(),
        value: conditionValue.trim(),
      },
    }),
    [conditionPath, conditionValue],
  );

  const previewAction = useMemo(
    () => actionMode === 'Goal'
      ? { Goal: { goal: actionTarget.trim() } }
      : { Pipeline: { pipeline_id: actionTarget.trim() } },
    [actionMode, actionTarget],
  );

  const triggerValidation = useMemo(
    () => validateTriggerBuilder({
      triggerId,
      eventType,
      conditionPath,
      conditionValue,
      actionMode,
      actionTarget,
      advancedTriggerMode,
      condition,
      action,
    }),
    [triggerId, eventType, conditionPath, conditionValue, actionMode, actionTarget, advancedTriggerMode, condition, action],
  );

  const eventPreview = useMemo(() => tryParseJson(publishPayload), [publishPayload]);

  const activitySummary = useMemo(() => {
    const completed = activity.filter((run) => run.status === 'completed').length;
    const failed = activity.filter((run) => run.status === 'failed').length;
    return {
      total: activity.length,
      completed,
      failed,
    };
  }, [activity]);

  const filteredActivity = useMemo(() => {
    return activity.filter((run) => {
      const matchesType = activityFilter === 'all' || run.source_type === activityFilter;
      const haystack = [
        run.source_id,
        run.action_type,
        run.source_type,
        run.error ?? '',
        JSON.stringify(run.request_payload ?? {}),
      ].join(' ').toLowerCase();
      const matchesQuery = activityQuery.trim() === '' || haystack.includes(activityQuery.toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [activity, activityFilter, activityQuery]);

  async function loadTriggers() {
    setLoading(true);
    try {
      const data = await eventsApi.listTriggers();
      setTriggers(data);
    } catch (error) {
      console.error('Failed to load triggers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadActivity() {
    try {
      const data = await executionsApi.list(25, 0);
      setActivity(data.filter((run) => run.source_type === 'event' || run.source_type === 'trigger'));
    } catch (error) {
      console.error('Failed to load trigger activity:', error);
    }
  }

  async function handleCreateTrigger() {
    setTriggerError('');

    const parsedCondition = advancedTriggerMode
      ? safeParseJson(condition)
      : asParseSuccess(previewCondition);
    const parsedAction = advancedTriggerMode
      ? safeParseJson(action)
      : asParseSuccess(previewAction);

    if (!parsedCondition.success || !parsedAction.success) {
      setTriggerError('Condition and action must be valid JSON.');
      return;
    }

    if (!triggerValidation.valid) {
      setTriggerError(triggerValidation.messages[0] ?? 'Trigger configuration is invalid.');
      return;
    }

    setSubmittingTrigger(true);
    try {
      await eventsApi.createTrigger({
        id: triggerId.trim(),
        event_type: eventType.trim(),
        condition: parsedCondition.value,
        action: parsedAction.value,
      });
      resetTriggerErrors();
      await Promise.all([loadTriggers(), loadActivity()]);
      toast.success(`Trigger "${triggerId.trim()}" created.`);
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to create trigger';
      setTriggerError(message);
    } finally {
      setSubmittingTrigger(false);
    }
  }

  async function handleDeleteTrigger(id: string) {
    const confirmed = await dialog.confirm({
      title: 'Delete trigger',
      description: `Trigger "${id}" will stop reacting to matching events.`,
      confirmLabel: 'Delete Trigger',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await eventsApi.deleteTrigger(id);
      await Promise.all([loadTriggers(), loadActivity()]);
      toast.success(`Trigger "${id}" deleted.`);
    } catch (error) {
      console.error('Failed to delete trigger:', error);
      await dialog.alert({
        title: 'Delete failed',
        description: 'The trigger could not be deleted.',
        tone: 'danger',
      });
    }
  }

  async function handlePublishEvent() {
    setEventError('');

    const parsedPayload = safeParseJson(publishPayload);
    if (!parsedPayload.success) {
      setEventError('Payload must be valid JSON.');
      return;
    }

    setPublishingEvent(true);
    try {
      await eventsApi.publishEvent({
        event_type: publishEventType.trim(),
        payload: parsedPayload.value,
      });
      await loadActivity();
      toast.success(`Event "${publishEventType.trim()}" published.`);
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to publish event';
      setEventError(message);
    } finally {
      setPublishingEvent(false);
    }
  }

  function resetTriggerErrors() {
    setTriggerError('');
  }

  return (
    <div className="p-4 max-w-[1200px] mx-auto min-h-screen">
      <TriggersHeader
        online={online}
        statusLoading={statusLoading}
        onRefresh={refreshStatus}
      />

      <TriggerBusPanel
        recentEvents={recentEvents}
        runtime={systemRuntime}
        loading={recentEventsLoading || runtimeLoading}
        onRefresh={() => {
          void refetchRecentEvents();
          void refetchRuntime();
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <TriggerBuilderCard
          triggerId={triggerId}
          eventType={eventType}
          conditionPath={conditionPath}
          conditionValue={conditionValue}
          actionMode={actionMode}
          actionTarget={actionTarget}
          advancedTriggerMode={advancedTriggerMode}
          condition={condition}
          action={action}
          error={triggerError}
          validation={triggerValidation}
          previewCondition={previewCondition}
          previewAction={previewAction}
          loading={submittingTrigger}
          online={online}
          onTriggerIdChange={setTriggerId}
          onEventTypeChange={setEventType}
          onConditionPathChange={setConditionPath}
          onConditionValueChange={setConditionValue}
          onActionModeChange={setActionMode}
          onActionTargetChange={setActionTarget}
          onAdvancedModeToggle={() => setAdvancedTriggerMode((value) => !value)}
          onConditionChange={setCondition}
          onActionChange={setAction}
          onSubmit={() => void handleCreateTrigger()}
        />

        <PublishEventCard
          publishEventType={publishEventType}
          publishPayload={publishPayload}
          eventPreview={eventPreview}
          error={eventError}
          loading={publishingEvent}
          online={online}
          onEventTypeChange={setPublishEventType}
          onPayloadChange={setPublishPayload}
          onSubmit={() => void handlePublishEvent()}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
        <RegisteredTriggersCard
          loading={loading}
          triggers={sortedTriggers}
          onRefresh={() => void loadTriggers()}
          onDelete={(id) => void handleDeleteTrigger(id)}
        />

        <TriggerActivityCard
          runs={filteredActivity}
          summary={activitySummary}
          filter={activityFilter}
          query={activityQuery}
          onFilterChange={setActivityFilter}
          onQueryChange={setActivityQuery}
          onRefresh={() => void loadActivity()}
        />
      </div>
    </div>
  );
};

function TriggersHeader({
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
        <div className="p-2 rounded-xs bg-monokai-purple/20 border border-monokai-purple/30">
          <BellRing className="w-5 h-5 text-monokai-purple" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gruv-light-0 tracking-tight">Triggers</h1>
          <p className="text-xs text-gruv-light-4 font-medium">Define event-driven automations and fire test events into stepbit-core.</p>
        </div>
      </div>

      <div className={`flex items-center gap-2 px-3 py-2 rounded-xs border glass ${online ? 'border-monokai-green/30 bg-monokai-green/5' : 'border-monokai-pink/30 bg-monokai-pink/5'}`}>
        <Activity className={`w-4 h-4 ${online ? 'text-monokai-green animate-pulse' : 'text-monokai-pink'}`} />
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

function TriggerBusPanel({
  recentEvents,
  runtime,
  loading,
  onRefresh,
}: {
  recentEvents?: CoreRecentEvent[];
  runtime?: CoreSystemRuntime;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="glass border-white/10 rounded-xs p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gruv-light-1">Core Event Bus</h2>
          <p className="text-xs text-gruv-light-4">Live trigger and event telemetry from stepbit-core. This sits alongside the local execution history so you can see what the core actually persisted.</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InfoStat label="Trigger Definitions" value={runtime ? String(runtime.trigger_count) : 'n/a'} />
          <InfoStat label="Scheduler" value={runtime ? (runtime.scheduler_active ? 'Running' : 'Stopped') : 'n/a'} />
          <InfoStat label="Recent Core Events" value={recentEvents ? String(recentEvents.length) : 'n/a'} />
        </div>

        <div className="rounded-xs border border-white/10 bg-white/5 p-3.5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gruv-light-1">Latest Persisted Events</h3>
              <p className="text-[11px] text-gruv-light-4">Read-only feed from the core event store.</p>
            </div>
          </div>

          {loading && !recentEvents ? (
            <div className="space-y-2">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="h-16 rounded-xs bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : !recentEvents?.length ? (
            <EmptyState
              icon={Activity}
              title="No core events yet"
              description="Publish a test event to populate the persisted event bus feed."
            />
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {recentEvents.map((event) => (
                <CoreEventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CoreEventRow({ event }: { event: CoreRecentEvent }) {
  return (
    <div className="rounded-xs border border-white/10 bg-gruv-dark-0/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gruv-light-1">{event.event_type}</p>
          <p className="text-[11px] text-gruv-light-4">{event.source_node || 'unknown source'}</p>
        </div>
        <span className="text-[11px] text-gruv-light-4">{formatDateTime(event.timestamp)}</span>
      </div>
      <p className="text-[11px] text-gruv-light-3 mt-2">{summarizeValue(event.payload)}</p>
    </div>
  );
}

function TriggerBuilderCard(props: {
  triggerId: string;
  eventType: string;
  conditionPath: string;
  conditionValue: string;
  actionMode: ActionMode;
  actionTarget: string;
  advancedTriggerMode: boolean;
  condition: string;
  action: string;
  error: string;
  validation: ValidationResult;
  previewCondition: Record<string, unknown>;
  previewAction: Record<string, unknown>;
  loading: boolean;
  online: boolean;
  onTriggerIdChange: (value: string) => void;
  onEventTypeChange: (value: string) => void;
  onConditionPathChange: (value: string) => void;
  onConditionValueChange: (value: string) => void;
  onActionModeChange: (value: ActionMode) => void;
  onActionTargetChange: (value: string) => void;
  onAdvancedModeToggle: () => void;
  onConditionChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const {
    triggerId,
    eventType,
    conditionPath,
    conditionValue,
    actionMode,
    actionTarget,
    advancedTriggerMode,
    condition,
    action,
    error,
    validation,
    previewCondition,
    previewAction,
    loading,
    online,
    onTriggerIdChange,
    onEventTypeChange,
    onConditionPathChange,
    onConditionValueChange,
    onActionModeChange,
    onActionTargetChange,
    onAdvancedModeToggle,
    onConditionChange,
    onActionChange,
    onSubmit,
  } = props;

  return (
    <section className="glass border-white/10 rounded-xs p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <Plus className="w-4 h-4 text-monokai-purple" />
        <h2 className="text-lg font-semibold text-gruv-light-1">New Trigger</h2>
      </div>

      <div className="space-y-4">
        <Field label="Trigger ID" value={triggerId} onChange={onTriggerIdChange} placeholder="file-processor" />
        <Field label="Event Type" value={eventType} onChange={onEventTypeChange} placeholder="file.created" />
        <Field label="Condition Path" value={conditionPath} onChange={onConditionPathChange} placeholder="extension" />
        <Field label="Condition Value" value={conditionValue} onChange={onConditionValueChange} placeholder=".pdf" />

        <div>
          <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">Action Type</label>
          <select
            value={actionMode}
            onChange={(event) => onActionModeChange(event.target.value as ActionMode)}
            className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1"
          >
            {ACTION_MODE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <Field
          label={actionMode === 'Goal' ? 'Goal Prompt' : 'Pipeline ID'}
          value={actionTarget}
          onChange={onActionTargetChange}
          placeholder={actionMode === 'Goal' ? 'Inspect the new PDF and summarize it' : 'nightly_analysis'}
        />

        <ToggleCard
          title="Advanced Trigger JSON"
          description="Switch to raw condition/action JSON only when the guided rule builder is not enough."
          active={advancedTriggerMode}
          onToggle={onAdvancedModeToggle}
        />

        {advancedTriggerMode ? (
          <>
            <JsonField label="Condition JSON" value={condition} onChange={onConditionChange} rows={8} />
            <JsonField label="Action JSON" value={action} onChange={onActionChange} rows={10} />
          </>
        ) : (
          <TriggerPreviewCard
            previewCondition={previewCondition}
            previewAction={previewAction}
            explanation={describeTriggerRule(eventType, conditionPath, conditionValue, actionMode, actionTarget)}
          />
        )}

        <ValidationPanel validation={validation} />

        {error && <ErrorBox message={error} />}

        <button
          onClick={onSubmit}
          disabled={loading || !online}
          className="w-full flex items-center justify-center gap-2 bg-monokai-purple text-white px-4 py-2.5 rounded-xs text-sm font-medium border border-monokai-purple/70 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {loading ? 'Creating...' : 'Create Trigger'}
        </button>
      </div>
    </section>
  );
}

function PublishEventCard(props: {
  publishEventType: string;
  publishPayload: string;
  eventPreview: ParseResult;
  error: string;
  loading: boolean;
  online: boolean;
  onEventTypeChange: (value: string) => void;
  onPayloadChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const {
    publishEventType,
    publishPayload,
    eventPreview,
    error,
    loading,
    online,
    onEventTypeChange,
    onPayloadChange,
    onSubmit,
  } = props;

  return (
    <section className="glass border-white/10 rounded-xs p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <Send className="w-4 h-4 text-monokai-aqua" />
        <h2 className="text-lg font-semibold text-gruv-light-1">Publish Test Event</h2>
      </div>

      <div className="space-y-4">
        <Field label="Event Type" value={publishEventType} onChange={onEventTypeChange} placeholder="file.created" />
        <JsonField label="Payload JSON" value={publishPayload} onChange={onPayloadChange} rows={12} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InfoStat label="Preview Status" value={eventPreview.success ? 'Valid JSON' : 'Invalid JSON'} />
          <InfoStat label="Payload Summary" value={eventPreview.success ? summarizeValue(eventPreview.value) : 'Fix JSON to inspect payload'} />
        </div>

        {eventPreview.success && (
          <JsonPreview label="Parsed Event Payload" value={eventPreview.value} defaultOpen={false} />
        )}

        {error && <ErrorBox message={error} />}

        <button
          onClick={onSubmit}
          disabled={loading || !online}
          className="w-full flex items-center justify-center gap-2 bg-monokai-aqua text-gruv-dark-0 px-4 py-2.5 rounded-xs text-sm font-medium border border-monokai-aqua/70 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Publishing...' : 'Publish Event'}
        </button>
      </div>
    </section>
  );
}

function RegisteredTriggersCard({
  loading,
  triggers,
  onRefresh,
  onDelete,
}: {
  loading: boolean;
  triggers: EventTrigger[];
  onRefresh: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="glass border-white/10 rounded-xs p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gruv-light-1">Registered Triggers</h2>
          <p className="text-xs text-gruv-light-4">Current trigger definitions loaded in stepbit-core.</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xs bg-white/5 hover:bg-white/10 transition-colors shrink-0"
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gruv-light-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="h-28 rounded-xs bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : triggers.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No triggers registered"
          description="Create one from the builder to start wiring events to actions."
        />
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger, index) => (
            <motion.div
              key={trigger.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-xs border border-white/10 bg-white/5 p-3.5"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gruv-light-1 break-all">{trigger.id}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-purple/15 text-monokai-purple border border-monokai-purple/20">
                      {trigger.event_type}
                    </span>
                  </div>

                  <InfoStat label="Rule" value={summarizeTrigger(trigger)} />
                  <JsonPreview label="Condition" value={trigger.condition} defaultOpen={false} />
                  <JsonPreview label="Action" value={trigger.action} defaultOpen={false} />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onDelete(trigger.id)}
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

function TriggerActivityCard({
  runs,
  summary,
  filter,
  query,
  onFilterChange,
  onQueryChange,
  onRefresh,
}: {
  runs: ExecutionRun[];
  summary: { total: number; completed: number; failed: number };
  filter: ActivityFilter;
  query: string;
  onFilterChange: (value: ActivityFilter) => void;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="glass border-white/10 rounded-xs p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gruv-light-1">Recent Trigger Activity</h2>
          <p className="text-xs text-gruv-light-4">Local execution history for trigger creation, deletion, and published events.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
        <InfoStat label="Visible Runs" value={String(runs.length)} />
        <InfoStat label="Completed" value={String(summary.completed)} />
        <InfoStat label="Failed" value={String(summary.failed)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterGroup<ActivityFilter>
          options={ACTIVITY_FILTER_OPTIONS}
          selected={filter}
          onSelect={onFilterChange}
          getToneClass={(option) => option === 'trigger' ? 'bg-monokai-purple text-white' : option === 'event' ? 'bg-monokai-aqua text-black' : 'bg-gruv-dark-0 text-gruv-light-1'}
        />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gruv-light-4" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter by source, action, payload or error..."
          className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 pl-9 pr-3 py-2.5 text-sm text-gruv-light-1"
        />
      </div>

      {runs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No trigger activity matches this view"
          description="Publish an event or adjust the filters to inspect local event and trigger runs."
        />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <ActivityRunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityRunCard({ run }: { run: ExecutionRun }) {
  return (
    <div className="rounded-xs border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gruv-light-1">{run.action_type}</p>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="text-[11px] text-gruv-light-4 mt-1">{run.source_type} • {run.source_id}</p>
          <p className="text-[11px] text-gruv-light-3 mt-2">{summarizeValue(run.request_payload)}</p>
        </div>
        <p className="text-[11px] text-gruv-light-3 shrink-0">{new Date(run.created_at).toLocaleString()}</p>
      </div>
      {run.error && <p className="mt-2 text-xs text-monokai-pink whitespace-pre-wrap">{run.error}</p>}
    </div>
  );
}

function ValidationPanel({ validation }: { validation: ValidationResult }) {
  return (
    <div className={`rounded-xs border p-3 ${validation.valid ? 'border-monokai-green/20 bg-monokai-green/10' : 'border-monokai-orange/20 bg-monokai-orange/10'}`}>
      <div className="flex items-center gap-2">
        {validation.valid ? (
          <CheckCircle2 className="w-4 h-4 text-monokai-green" />
        ) : (
          <XCircle className="w-4 h-4 text-monokai-orange" />
        )}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gruv-light-2">Builder Validation</p>
      </div>
      <div className="mt-2 space-y-1">
        {validation.messages.map((message) => (
          <p key={message} className="text-xs text-gruv-light-2">{message}</p>
        ))}
      </div>
    </div>
  );
}

function TriggerPreviewCard({
  previewCondition,
  previewAction,
  explanation,
}: {
  previewCondition: Record<string, unknown>;
  previewAction: Record<string, unknown>;
  explanation: string;
}) {
  return (
    <div className="space-y-3">
      <InfoStat label="Rule Explanation" value={explanation} />
      <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4 mb-2">Trigger Preview</p>
        <pre className="text-[11px] text-monokai-purple whitespace-pre-wrap font-mono">
          {JSON.stringify({ condition: previewCondition, action: previewAction }, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ToggleCard({
  title,
  description,
  active,
  onToggle,
}: {
  title: string;
  description: string;
  active: boolean;
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
        className={`relative w-12 h-7 rounded-xs transition-colors ${active ? 'bg-monokai-purple' : 'bg-gruv-dark-4'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-xs bg-white transition-transform ${active ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

function FilterGroup<T extends string>({
  options,
  selected,
  onSelect,
  getToneClass,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  getToneClass: (value: T) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <button
            key={option}
            onClick={() => onSelect(option)}
            className={`px-2.5 py-1.5 rounded-xs text-xs font-semibold transition-colors ${isSelected ? getToneClass(option) : 'bg-white/5 text-gruv-light-3'}`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-monokai-green/15 text-monokai-green border-monokai-green/20">
        completed
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-monokai-pink/15 text-monokai-pink border-monokai-pink/20">
        failed
      </span>
    );
  }

  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-monokai-orange/15 text-monokai-orange border-monokai-orange/20">
      running
    </span>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1"
      />
    </div>
  );
}

function JsonField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-monokai-green font-mono"
      />
    </div>
  );
}

function JsonPreview({
  label,
  value,
  defaultOpen,
}: {
  label: string;
  value: unknown;
  defaultOpen: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded-xs border border-white/10 bg-gruv-dark-0/70">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-gruv-light-3">{label}</summary>
      <pre className="px-3 pb-3 text-sm text-monokai-green overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
      <p className="mt-1.5 text-xs font-semibold text-gruv-light-1 break-words">{value}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 px-3 py-2.5 text-sm text-monokai-pink">
      {message}
    </div>
  );
}

type ValidationResult = {
  valid: boolean;
  messages: string[];
};

type ParseResult =
  | { success: true; value: any }
  | { success: false };

function asParseSuccess(value: any): ParseResult {
  return { success: true, value };
}

function validateTriggerBuilder(input: {
  triggerId: string;
  eventType: string;
  conditionPath: string;
  conditionValue: string;
  actionMode: ActionMode;
  actionTarget: string;
  advancedTriggerMode: boolean;
  condition: string;
  action: string;
}): ValidationResult {
  const messages: string[] = [];

  if (input.triggerId.trim() === '') {
    messages.push('Trigger ID is required.');
  }
  if (input.eventType.trim() === '') {
    messages.push('Event type is required.');
  }

  if (input.advancedTriggerMode) {
    if (!safeParseJson(input.condition).success) {
      messages.push('Condition JSON must parse successfully.');
    }
    if (!safeParseJson(input.action).success) {
      messages.push('Action JSON must parse successfully.');
    }
  } else {
    if (input.conditionPath.trim() === '') {
      messages.push('Condition path is required in guided mode.');
    }
    if (input.conditionValue.trim() === '') {
      messages.push('Condition value is required in guided mode.');
    }
    if (input.actionTarget.trim() === '') {
      messages.push(input.actionMode === 'Goal' ? 'Goal prompt is required.' : 'Pipeline ID is required.');
    }
  }

  if (messages.length === 0) {
    messages.push('Trigger looks valid and ready to register.');
  }

  return {
    valid: messages.length === 1 && messages[0] === 'Trigger looks valid and ready to register.',
    messages,
  };
}

function describeTriggerRule(
  eventType: string,
  conditionPath: string,
  conditionValue: string,
  actionMode: ActionMode,
  actionTarget: string,
) {
  const actionDescription = actionMode === 'Goal'
    ? `run goal "${actionTarget.trim() || '...'}"`
    : `run pipeline "${actionTarget.trim() || '...'}"`;

  return `When event "${eventType.trim() || '...'}" arrives and "${conditionPath.trim() || '...'}" equals "${conditionValue.trim() || '...'}", ${actionDescription}.`;
}

function summarizeTrigger(trigger: EventTrigger) {
  return `On ${trigger.event_type}, evaluate ${summarizeValue(trigger.condition)} and execute ${summarizeValue(trigger.action)}.`;
}

function summarizeValue(value: unknown) {
  if (value == null) return 'No value';
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  if (Array.isArray(value)) return value.length === 0 ? 'Empty list' : `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return 'Empty object';
    return keys.slice(0, 4).join(', ') + (keys.length > 4 ? ` +${keys.length - 4} more` : '');
  }
  return String(value);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function safeParseJson(input: string): ParseResult {
  try {
    return { success: true, value: JSON.parse(input) };
  } catch {
    return { success: false };
  }
}

function tryParseJson(input: string): ParseResult {
  return safeParseJson(input);
}

export default Triggers;
