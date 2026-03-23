import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { executionsApi, type ExecutionRun } from '../api/executions';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Filter, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import { Link } from 'react-router';
import { useAppDialog } from '../components/ui/AppDialogProvider';
import { toast } from 'sonner';

type RunStatusFilter = 'all' | 'completed' | 'failed' | 'running';
type TimeWindowFilter = 'all' | '24h' | '7d';
type SummaryTone = 'aqua' | 'green' | 'pink' | 'orange';
type SourceSummary = { sourceType: string; count: number; failedCount: number };

const TIME_WINDOW_OPTIONS: TimeWindowFilter[] = ['all', '24h', '7d'];
const STATUS_FILTER_OPTIONS: RunStatusFilter[] = ['all', 'completed', 'failed', 'running'];
const SUMMARY_TONE_STYLES: Record<SummaryTone, string> = {
  aqua: 'text-monokai-aqua border-monokai-aqua/20 bg-monokai-aqua/10',
  green: 'text-monokai-green border-monokai-green/20 bg-monokai-green/10',
  pink: 'text-monokai-pink border-monokai-pink/20 bg-monokai-pink/10',
  orange: 'text-monokai-orange border-monokai-orange/20 bg-monokai-orange/10',
};

const ExecutionHistory: React.FC = () => {
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [windowFilter, setWindowFilter] = useState<TimeWindowFilter>('all');
  const [query, setQuery] = useState('');
  const [deletingRunId, setDeletingRunId] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const dialog = useAppDialog();

  useEffect(() => {
    void loadRuns();
  }, []);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const data = await executionsApi.list();
      setRuns(data);
    } catch (error) {
      console.error('Failed to load execution history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRun = async (runId: number) => {
    const confirmed = await dialog.confirm({
      title: 'Delete execution',
      description: `Execution #${runId} will be removed from local history.`,
      confirmLabel: 'Delete Execution',
      tone: 'danger',
    });
    if (!confirmed) return;
    setDeletingRunId(runId);
    try {
      await executionsApi.delete(runId);
      setRuns((prev) => prev.filter((run) => run.id !== runId));
      toast.success(`Execution #${runId} deleted.`);
    } catch (error) {
      console.error('Failed to delete execution run:', error);
      await dialog.alert({
        title: 'Delete failed',
        description: `Execution #${runId} could not be deleted.`,
        tone: 'danger',
      });
    } finally {
      setDeletingRunId(null);
    }
  };

  const handleDeleteAllRuns = async () => {
    const confirmed = await dialog.confirm({
      title: 'Clear execution history',
      description: 'This removes every locally stored execution entry from the app.',
      confirmLabel: 'Clear History',
      tone: 'danger',
    });
    if (!confirmed) return;
    setClearingAll(true);
    try {
      await executionsApi.deleteAll();
      setRuns([]);
      toast.success('Execution history cleared.');
    } catch (error) {
      console.error('Failed to clear execution history:', error);
      await dialog.alert({
        title: 'Clear failed',
        description: 'The local execution history could not be cleared.',
        tone: 'danger',
      });
    } finally {
      setClearingAll(false);
    }
  };

  const filteredRuns = useMemo(() => {
    const now = Date.now();
    return runs.filter((run) => {
      const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || run.source_type === sourceFilter;
      const matchesWindow = windowFilter === 'all'
        || (windowFilter === '24h' && now - new Date(run.created_at).getTime() <= 24 * 60 * 60 * 1000)
        || (windowFilter === '7d' && now - new Date(run.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000);
      const haystack = `${run.source_id} ${run.action_type} ${run.source_type} ${JSON.stringify(run.request_payload ?? {})} ${run.error ?? ''}`.toLowerCase();
      const matchesQuery = query.trim() === '' || haystack.includes(query.toLowerCase());
      return matchesStatus && matchesSource && matchesWindow && matchesQuery;
    });
  }, [runs, statusFilter, sourceFilter, windowFilter, query]);

  const sourceOptions = useMemo(
    () => ['all', ...Array.from(new Set(runs.map((run) => run.source_type))).sort()],
    [runs],
  );

  const summary = useMemo(() => {
    const failed = filteredRuns.filter((run) => run.status === 'failed').length;
    const completed = filteredRuns.filter((run) => run.status === 'completed').length;
    const running = filteredRuns.filter((run) => run.status === 'running').length;
    const avgDurationMs = filteredRuns
      .filter((run) => run.completed_at)
      .map((run) => new Date(run.completed_at!).getTime() - new Date(run.created_at).getTime())
      .filter((ms) => ms >= 0);
    const average = avgDurationMs.length === 0
      ? 'n/a'
      : avgDurationMs.length === 1
        ? formatDurationMs(avgDurationMs[0])
        : formatDurationMs(Math.round(avgDurationMs.reduce((sum, value) => sum + value, 0) / avgDurationMs.length));

    return {
      total: filteredRuns.length,
      failed,
      completed,
      running,
      average,
    };
  }, [filteredRuns]);

  const recentFailures = useMemo(
    () => filteredRuns.filter((run) => run.status === 'failed').slice(0, 3),
    [filteredRuns],
  );

  const sourceSummary = useMemo<SourceSummary[]>(
    () =>
      Array.from(
        filteredRuns.reduce((map, run) => {
          const current = map.get(run.source_type) ?? { sourceType: run.source_type, count: 0, failedCount: 0 };
          current.count += 1;
          if (run.status === 'failed') current.failedCount += 1;
          map.set(run.source_type, current);
          return map;
        }, new Map<string, SourceSummary>()),
      )
        .map(([, value]) => value)
        .sort((left, right) => right.count - left.count),
    [filteredRuns],
  );

  return (
    <div className="p-4 max-w-6xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xs bg-monokai-green/20 border border-monokai-green/30">
            <Clock3 className="w-5 h-5 text-monokai-green" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gruv-light-0 tracking-tight">Execution History</h1>
            <p className="text-xs text-gruv-light-4 font-medium">Local history of actions triggered from stepbit-app across pipelines, jobs, triggers, and events.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gruv-light-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search source or action..."
              className="rounded-xs bg-white/5 border border-white/10 pl-9 pr-3 py-2 text-xs text-gruv-light-1"
            />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-xs bg-white/5 border border-white/10 px-3 py-2 text-xs text-gruv-light-1"
          >
            {sourceOptions.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
          <FilterToggleGroup<TimeWindowFilter>
            options={TIME_WINDOW_OPTIONS}
            selected={windowFilter}
            onSelect={setWindowFilter}
            activeClassName="bg-monokai-aqua text-black"
          />
          <FilterToggleGroup<RunStatusFilter>
            options={STATUS_FILTER_OPTIONS}
            selected={statusFilter}
            onSelect={setStatusFilter}
            activeClassName="bg-monokai-green text-black"
          />
          <button
            onClick={() => void loadRuns()}
            className="p-2 rounded-xs bg-white/5 hover:bg-white/10 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gruv-light-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => void handleDeleteAllRuns()}
            className="inline-flex items-center gap-2 rounded-xs border border-monokai-pink/20 bg-monokai-pink/10 px-3 py-2 text-xs text-monokai-pink disabled:opacity-50"
            disabled={loading || clearingAll || runs.length === 0}
          >
            {clearingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {clearingAll ? 'Clearing...' : 'Clear History'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard icon={Activity} label="Visible Runs" value={String(summary.total)} tone="aqua" />
        <SummaryCard icon={CheckCircle2} label="Completed" value={String(summary.completed)} tone="green" />
        <SummaryCard icon={AlertTriangle} label="Failures" value={String(summary.failed)} tone="pink" />
        <SummaryCard icon={Clock3} label="Avg Duration" value={summary.average} tone="orange" />
      </div>

      <div className="rounded-xs border border-white/10 bg-white/5 p-3 mb-5 flex flex-wrap items-center gap-2 text-[11px] text-gruv-light-3">
        <Filter className="w-3.5 h-3.5 text-gruv-light-4" />
        <span>Showing runs for</span>
        <FilterChip label={`status: ${statusFilter}`} />
        <FilterChip label={`source: ${sourceFilter}`} />
        <FilterChip label={`window: ${windowFilter}`} />
        {query.trim() !== '' && <FilterChip label={`query: ${query}`} />}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4 mb-5">
        <SourceCoverageCard items={sourceSummary} />
        <FailureStrip failures={recentFailures} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="h-28 rounded-xs bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-xs glass">
          <Activity className="w-8 h-8 text-gruv-light-4 mx-auto mb-3" />
          <p className="text-gruv-light-3 text-sm font-semibold">No execution history yet</p>
          <p className="text-xs text-gruv-light-4 mt-1.5">Run a pipeline, trigger a job, create a trigger, or publish an event to populate this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRuns.map((run, index) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className="rounded-xs border border-white/10 bg-white/5 p-3.5"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gruv-light-1">#{run.id}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-aqua/15 text-monokai-aqua border border-monokai-aqua/20">
                    {run.source_type}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gruv-dark-0 text-gruv-light-3 border border-white/10">
                    {run.action_type}
                  </span>
                  <StatusBadge status={run.status} />
                  <button
                    type="button"
                    onClick={() => void handleDeleteRun(run.id)}
                    disabled={deletingRunId === run.id}
                    className="ml-auto inline-flex items-center gap-1 rounded-xs border border-monokai-pink/20 bg-monokai-pink/10 px-2.5 py-1 text-[11px] text-monokai-pink disabled:opacity-50"
                  >
                    {deletingRunId === run.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <RunStat label="Source ID" value={run.source_id} />
                  <RunStat label="Created" value={new Date(run.created_at).toLocaleString()} />
                  <RunStat label="Completed" value={run.completed_at ? new Date(run.completed_at).toLocaleString() : 'Pending'} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <RunStat label="Duration" value={formatDuration(run.created_at, run.completed_at)} />
                  <RunLink run={run} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <PayloadPreview label="Request Summary" value={run.request_payload} />
                  <PayloadPreview label="Response Summary" value={run.response_payload} />
                </div>

                <JsonDetails label="Request Payload" value={run.request_payload} defaultOpen={run.status === 'failed'} />
                <JsonDetails label="Response Payload" value={run.response_payload} />

                {run.error && (
                  <div className="rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 px-3 py-2 text-xs text-monokai-pink">
                    {run.error}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone: SummaryTone }) => {
  return (
    <div className="rounded-xs border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <div className={`rounded-xs border p-2 ${SUMMARY_TONE_STYLES[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
          <p className="mt-1 text-lg font-semibold text-gruv-light-1">{value}</p>
        </div>
      </div>
    </div>
  );
};

const SourceCoverageCard = ({ items }: { items: SourceSummary[] }) => (
  <div className="rounded-xs border border-white/10 bg-white/5 p-4">
    <div className="flex items-center justify-between gap-3 mb-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Surface Coverage</p>
        <p className="mt-1 text-sm font-semibold text-gruv-light-1">Visible executions by source type</p>
      </div>
    </div>
    {items.length === 0 ? (
      <p className="text-xs text-gruv-light-3">No runs in the current filter set.</p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item.sourceType} className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{item.sourceType}</p>
            <p className="mt-1 text-sm font-semibold text-gruv-light-1">{item.count} runs</p>
            <p className={`mt-1 text-[11px] ${item.failedCount > 0 ? 'text-monokai-pink' : 'text-gruv-light-3'}`}>
              {item.failedCount > 0 ? `${item.failedCount} failed` : 'No failures'}
            </p>
          </div>
        ))}
      </div>
    )}
  </div>
);

const FailureStrip = ({ failures }: { failures: ExecutionRun[] }) => (
  <div className="rounded-xs border border-white/10 bg-white/5 p-4">
    <div className="flex items-center gap-2 mb-3">
      <AlertTriangle className="w-4 h-4 text-monokai-pink" />
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Recent Failures</p>
        <p className="mt-1 text-sm font-semibold text-gruv-light-1">Fast path into the latest broken runs</p>
      </div>
    </div>
    {failures.length === 0 ? (
      <p className="text-xs text-gruv-light-3">No failed executions in the current filter set.</p>
    ) : (
      <div className="space-y-2">
        {failures.map((run) => (
          <div key={run.id} className="rounded-xs border border-monokai-pink/20 bg-monokai-pink/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gruv-light-1 truncate">{run.action_type}</p>
                <p className="text-[11px] text-gruv-light-3 truncate">{run.source_type} • {run.source_id}</p>
              </div>
              <p className="text-[11px] text-gruv-light-3 shrink-0">{new Date(run.created_at).toLocaleString()}</p>
            </div>
            {run.error && <p className="mt-2 text-[11px] text-monokai-pink whitespace-pre-wrap">{run.error}</p>}
          </div>
        ))}
      </div>
    )}
  </div>
);

const FilterToggleGroup = <T extends string>({
  options,
  selected,
  onSelect,
  activeClassName,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  activeClassName: string;
}) => (
  <div className="flex items-center gap-1 rounded-xs border border-white/10 bg-white/5 p-1.5">
    {options.map((option) => (
      <button
        key={option}
        onClick={() => onSelect(option)}
        className={`px-2.5 py-1.5 rounded-xs text-xs font-semibold transition-colors ${
          selected === option ? activeClassName : 'text-gruv-light-3 hover:bg-white/10'
        }`}
      >
        {option}
      </button>
    ))}
  </div>
);

const FilterChip = ({ label }: { label: string }) => (
  <span className="inline-flex items-center rounded-full border border-white/10 bg-gruv-dark-0/70 px-2 py-1 font-semibold text-gruv-light-2">
    {label}
  </span>
);

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'completed') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-green/15 text-monokai-green border border-monokai-green/20"><CheckCircle2 className="w-3 h-3" />completed</span>;
  }
  if (status === 'failed') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-pink/15 text-monokai-pink border border-monokai-pink/20"><XCircle className="w-3 h-3" />failed</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-orange/15 text-monokai-orange border border-monokai-orange/20"><Clock3 className="w-3 h-3" />running</span>;
};

const RunStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
    <p className="mt-1.5 text-xs font-semibold text-gruv-light-1 break-words">{value}</p>
  </div>
);

const PayloadPreview = ({ label, value }: { label: string; value: any }) => {
  const preview = summarizePayload(value);
  return <RunStat label={label} value={preview} />;
};

const JsonDetails = ({ label, value, defaultOpen = false }: { label: string; value: any; defaultOpen?: boolean }) => (
  <details open={defaultOpen} className="rounded-xs border border-white/10 bg-gruv-dark-0/70">
    <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-gruv-light-3">{label}</summary>
    <pre className="px-3 pb-3 text-[11px] text-monokai-green overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  </details>
);

const RunLink = ({ run }: { run: ExecutionRun }) => {
  const href = getRunHref(run);
  const label = getRunLinkLabel(run);
  return (
    <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Related View</p>
      {href ? (
        <Link className="mt-1.5 inline-block text-xs font-semibold text-monokai-aqua hover:underline" to={href}>
          {label}
        </Link>
      ) : (
        <p className="mt-1.5 text-xs font-semibold text-gruv-light-3 break-words">No direct route</p>
      )}
    </div>
  );
};

const getRunHref = (run: ExecutionRun) => {
  switch (run.source_type) {
    case 'pipeline':
      return '/pipelines';
    case 'goal':
      return '/goals';
    case 'cron_job':
      return '/scheduled-jobs';
    case 'trigger':
    case 'event':
      return '/triggers';
    case 'mcp_tool':
      return '/mcp-tools';
    default:
      return '';
  }
};

const getRunLinkLabel = (run: ExecutionRun) => {
  switch (run.source_type) {
    case 'pipeline':
      return 'Open pipelines view';
    case 'goal':
      return 'Open goals view';
    case 'cron_job':
      return 'Open scheduled jobs view';
    case 'trigger':
    case 'event':
      return 'Open triggers view';
    case 'mcp_tool':
      return 'Open MCP tools view';
    default:
      return 'Open related resource';
  }
};

const formatDuration = (createdAt: string, completedAt: string | null) => {
  if (!completedAt) return 'In progress';
  const durationMs = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  return formatDurationMs(durationMs);
};

const formatDurationMs = (durationMs: number) => {
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(2)} s`;
  return `${(durationMs / 60_000).toFixed(2)} min`;
};

const summarizePayload = (value: any) => {
  if (value == null) return 'No payload';
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  if (Array.isArray(value)) return value.length === 0 ? 'Empty list' : `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return 'Empty object';
    return keys.slice(0, 4).join(', ') + (keys.length > 4 ? ` +${keys.length - 4} more` : '');
  }
  return String(value);
};

export default ExecutionHistory;
