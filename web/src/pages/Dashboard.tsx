import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Activity, AlertCircle, AlertTriangle, CheckCircle2, Clock, Cpu, Gauge, HardDrive, History, Layers, Loader2, MessageCircle, PlugZap, Zap } from 'lucide-react';
import { Tooltip } from '../components/Tooltip';
import { getMcpProviders } from '../api/llm';
import { sessionsApi } from '../api/sessions';
import { executionsApi, type ExecutionRun } from '../api/executions';
import type { McpProviderStatus, MemoryUsageEntry, StepbitCoreStatus } from '../types';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { useStepbitCore } from '../hooks/useStepbitCore';
import { cn } from '../utils/cn';

type Tone = 'green' | 'orange' | 'pink' | 'gray';
type StatCardColor = 'monokai-aqua' | 'monokai-pink' | 'monokai-purple' | 'gruv-yellow' | 'monokai-green' | 'monokai-orange';

const CORE_RUN_SOURCE_TYPES = ['pipeline', 'goal', 'cron_job', 'trigger', 'event', 'mcp_tool'];
const STATUS_STYLES = {
  completed: 'bg-monokai-green/15 text-monokai-green border-monokai-green/20',
  failed: 'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/20',
  running: 'bg-monokai-orange/15 text-monokai-orange border-monokai-orange/20',
};
const OPS_CARD_TONES: Record<Tone, string> = {
  green: 'border-monokai-green/20 bg-monokai-green/5 text-monokai-green',
  orange: 'border-monokai-orange/20 bg-monokai-orange/5 text-monokai-orange',
  pink: 'border-monokai-pink/20 bg-monokai-pink/5 text-monokai-pink',
  gray: 'border-white/10 bg-white/5 text-gruv-light-3',
};

export const Dashboard = () => {
  const health = useHealthCheck();
  const core = useStepbitCore(10000);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => sessionsApi.getStats(),
    refetchInterval: 5000,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list(),
    retry: false,
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['executions-dashboard'],
    queryFn: () => executionsApi.list(20, 0),
    refetchInterval: 5000,
    retry: false,
  });

  const { data: mcpProviders, isLoading: providersLoading } = useQuery({
    queryKey: ['mcp-providers'],
    queryFn: () => getMcpProviders(),
    refetchInterval: 10000,
    retry: false,
  });

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const safeRuns = Array.isArray(runs) ? runs : [];
  const safeProviders = Array.isArray(mcpProviders) ? mcpProviders : [];

  const runtimeSummary = useMemo(() => buildRuntimeSummary(core, safeRuns), [core, safeRuns]);
  const memoryEntries = useMemo(
    () => [...(stats?.memory_usage ?? [])].sort((left: MemoryUsageEntry, right: MemoryUsageEntry) => right.usage_bytes - left.usage_bytes),
    [stats?.memory_usage],
  );
  const totalMemory = useMemo(
    () => memoryEntries.reduce((sum, entry) => sum + entry.usage_bytes, 0),
    [memoryEntries],
  );

  return (
    <div className="flex flex-col gap-5">
      <DashboardHeader health={health} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard title="Total Sessions" value={formatNumber(stats?.total_sessions ?? 0)} icon={Layers} color="monokai-aqua" isLoading={statsLoading} />
        <StatCard title="Total Messages" value={formatNumber(stats?.total_messages ?? 0)} icon={MessageCircle} color="monokai-pink" isLoading={statsLoading} />
        <StatCard title="Tokens Used" value={formatNumber(stats?.total_tokens ?? 0)} icon={Zap} color="monokai-purple" isLoading={statsLoading} />
        <StatCard title="DB Storage" value={formatBytes(stats?.db_size_bytes ?? 0)} icon={HardDrive} color="gruv-yellow" isLoading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard title="Core Active Sessions" value={formatNumber(core.metrics.active_sessions ?? 0)} icon={Cpu} color="monokai-aqua" isLoading={core.loading} />
        <StatCard title="Core Requests" value={formatNumber(core.metrics.requests_total ?? 0)} icon={Activity} color="monokai-green" isLoading={core.loading} />
        <StatCard title="Core Tokens" value={formatNumber(core.metrics.tokens_generated_total ?? 0)} icon={Zap} color="monokai-pink" isLoading={core.loading} />
        <StatCard title="Avg Token Latency" value={`${(core.metrics.token_latency_avg_ms ?? 0).toFixed(1)} ms`} icon={Gauge} color="monokai-orange" isLoading={core.loading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <OpsCard
          label="Core Readiness"
          value={runtimeSummary.readiness.label}
          tone={runtimeSummary.readiness.tone}
          detail={runtimeSummary.readiness.detail}
        />
        <OpsCard
          label="Runtime Pressure"
          value={runtimeSummary.pressure.label}
          tone={runtimeSummary.pressure.tone}
          detail={runtimeSummary.pressure.detail}
        />
        <OpsCard
          label="Recent Core Failures"
          value={String(runtimeSummary.recentFailures.length)}
          tone={runtimeSummary.recentFailures.length === 0 ? 'green' : 'orange'}
          detail={runtimeSummary.recentFailures.length === 0 ? 'No recent failed runs in local history.' : 'See the failure feed below for the latest problem runs.'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MemoryBreakdownCard entries={memoryEntries} totalMemory={totalMemory} loading={statsLoading} />
        <CoreRuntimeCard core={core} runtimeSummary={runtimeSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentSessionsCard sessions={safeSessions} loading={sessionsLoading} />
        <CoreActivityFeedCard runs={runtimeSummary.coreRuns} failures={runtimeSummary.recentFailures} loading={runsLoading} />
      </div>

      <ControlPlaneSummaryCard core={core} providers={safeProviders} loading={providersLoading} />

      <McpProvidersCard providers={safeProviders} loading={providersLoading} />
    </div>
  );
};

function DashboardHeader({ health }: { health: ReturnType<typeof useHealthCheck> }) {
  return (
    <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">System Overview</h1>
        <p className="text-xs text-gruv-light-4">Real-time performance metrics, readiness, and runtime visibility.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <HealthBadge
          tooltip={health.apiConnected ? 'API is responding correctly' : 'Critical: API unreachable'}
          active={health.apiConnected}
          activeClassName="border-monokai-green/30 text-monokai-green bg-monokai-green/5"
          inactiveClassName="border-monokai-red/50 text-monokai-red bg-monokai-red/10 shadow-[0_0_15px_rgba(249,38,114,0.2)]"
          label={`API: ${health.apiConnected ? 'READY' : 'DISCONNECTED'}`}
          inactiveIcon={AlertCircle}
        />

        <HealthBadge
          tooltip={health.dbConnected ? 'DuckDB connection active' : 'Warning: Database disconnected'}
          active={health.dbConnected}
          activeClassName="border-monokai-aqua/30 text-monokai-aqua bg-monokai-aqua/5"
          inactiveClassName="border-monokai-orange/50 text-monokai-orange bg-monokai-orange/10 shadow-[0_0_15px_rgba(253,151,31,0.2)]"
          label={`DB: ${health.dbConnected ? 'CONNECTED' : 'OFFLINE'}`}
          inactiveIcon={AlertTriangle}
        />

        <Tooltip content={health.llmosConnected ? (health.llmosReady ? 'stepbit-core is online and ready' : 'stepbit-core is online but still warming up') : 'stepbit-core is offline'}>
          <div
            className={cn(
              'px-3 py-1.5 rounded-full border flex items-center gap-2 font-mono text-xs transition-all',
              health.llmosConnected
                ? health.llmosReady
                  ? 'border-monokai-green/30 text-monokai-green bg-monokai-green/5'
                  : 'border-monokai-orange/40 text-monokai-orange bg-monokai-orange/10'
                : 'border-gruv-dark-4 text-gruv-gray bg-gruv-dark-4/10',
            )}
          >
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                health.llmosConnected
                  ? health.llmosReady
                    ? 'bg-monokai-green'
                    : 'bg-monokai-orange'
                  : 'bg-gruv-dark-4',
              )}
            />
            CORE: {health.llmosConnected ? (health.llmosReady ? 'READY' : 'WARMING') : 'OFFLINE'}
          </div>
        </Tooltip>
      </div>
    </header>
  );
}

function HealthBadge({
  tooltip,
  active,
  activeClassName,
  inactiveClassName,
  label,
  inactiveIcon: InactiveIcon,
}: {
  tooltip: string;
  active: boolean;
  activeClassName: string;
  inactiveClassName: string;
  label: string;
  inactiveIcon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Tooltip content={tooltip}>
      <div className={cn('px-3 py-1.5 rounded-full border flex items-center gap-2 font-mono text-xs transition-all', active ? activeClassName : inactiveClassName)}>
        {!active && <InactiveIcon className="w-3.5 h-3.5 animate-pulse" />}
        <div className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-current' : 'bg-current')} />
        {label}
      </div>
    </Tooltip>
  );
}

function MemoryBreakdownCard({
  entries,
  totalMemory,
  loading,
}: {
  entries: MemoryUsageEntry[];
  totalMemory: number;
  loading: boolean;
}) {
  return (
    <div className="glass p-4 rounded-xs min-h-72 flex flex-col">
      <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
        <Activity className="text-monokai-aqua w-4 h-4" />
        Memory Breakdown
      </h3>
      <div className="flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
        {loading ? (
          <LoadingPane colorClassName="text-monokai-aqua" />
        ) : entries.length > 0 ? (
          entries.map((entry, index) => (
            <div key={`${entry.tag ?? 'system'}-${index}`} className="flex flex-col gap-1.5 p-2.5 bg-gruv-dark-4/10 rounded-xs border border-gruv-dark-4/20">
              <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-gruv-light-4">
                <span>{entry.tag?.replace(/_/g, ' ') || 'SYSTEM'}</span>
                <span className="text-monokai-aqua">{formatBytes(entry.usage_bytes)}</span>
              </div>
              <div className="w-full bg-gruv-dark-4/30 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-monokai-aqua shadow-[0_0_10px_rgba(166,226,46,0.3)] transition-all duration-1000"
                  style={{ width: `${Math.min(100, ((entry.usage_bytes / (totalMemory || 1)) * 100))}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <EmptyPane icon={Activity} label="No memory data available" />
        )}
      </div>
    </div>
  );
}

function CoreRuntimeCard({
  core,
  runtimeSummary,
}: {
  core: ReturnType<typeof useStepbitCore>;
  runtimeSummary: ReturnType<typeof buildRuntimeSummary>;
}) {
  const capabilityRows = [
    {
      label: 'Planner Endpoints',
      value: core.capabilities?.planner_http ? 'Available' : 'App-managed fallback',
      accent: core.capabilities?.planner_http ? 'text-monokai-green' : 'text-monokai-orange',
    },
    {
      label: 'Distributed Surface',
      value: core.capabilities?.distributed_http ? 'Exposed' : 'Not exposed yet',
      accent: core.capabilities?.distributed_http ? 'text-monokai-green' : 'text-gruv-light-3',
    },
    {
      label: 'MCP Registry',
      value: core.capabilities?.mcp_registry_http ? 'Available' : 'Indirect or unavailable',
      accent: core.capabilities?.mcp_registry_http ? 'text-monokai-green' : 'text-gruv-light-3',
    },
    {
      label: 'Metrics Surface',
      value: core.capabilities?.metrics_http ? 'Exposed' : 'App-derived only',
      accent: core.capabilities?.metrics_http ? 'text-monokai-green' : 'text-monokai-orange',
    },
  ];

  return (
    <div className="glass p-4 rounded-xs min-h-72 flex flex-col">
      <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
        <CheckCircle2 className="text-monokai-green w-4 h-4" />
        Core Runtime
      </h3>
      <div className="grid grid-cols-1 gap-3">
        <RuntimeRow label="Connectivity" value={core.online ? 'Online' : 'Offline'} accent={core.online ? 'text-monokai-green' : 'text-monokai-pink'} />
        <RuntimeRow label="Readiness" value={core.ready ? 'Ready' : 'Not Ready'} accent={core.ready ? 'text-monokai-green' : 'text-monokai-orange'} />
        <RuntimeRow label="Active Model" value={core.active_model || 'Unavailable'} />
        <RuntimeRow label="Discovered Models" value={core.supported_models.length ? core.supported_models.join(', ') : 'None detected'} />
        {capabilityRows.map((row) => (
          <RuntimeRow key={row.label} label={row.label} value={row.value} accent={row.accent} />
        ))}
        <RuntimeRow label="Recent Failure Source" value={runtimeSummary.recentFailures[0] ? `${runtimeSummary.recentFailures[0].source_type} • ${runtimeSummary.recentFailures[0].source_id}` : 'No recent failures'} accent={runtimeSummary.recentFailures[0] ? 'text-monokai-orange' : 'text-monokai-green'} />
        <InfoBox icon={Clock} label="Core Message" toneClassName="text-monokai-purple" content={core.message} />
        <InfoBox
          icon={AlertTriangle}
          label="Runtime Warnings"
          toneClassName="text-monokai-orange"
          content={core.warnings && core.warnings.length > 0 ? core.warnings.join('\n') : 'No active runtime warnings reported by the app-level status view.'}
          prewrap
        />
      </div>
    </div>
  );
}

function RecentSessionsCard({
  sessions,
  loading,
}: {
  sessions: Array<{ id: string; title?: string; name?: string; created_at: string; metadata?: { message_count?: number } }>;
  loading: boolean;
}) {
  return (
    <div className="glass p-4 rounded-xs min-h-72 flex flex-col">
      <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
        <MessageCircle className="text-monokai-purple w-4 h-4" />
        Recent Sessions
      </h3>
      <div className="flex flex-col gap-2 overflow-y-auto">
        {loading ? (
          <LoadingPane colorClassName="text-monokai-purple" />
        ) : sessions.length > 0 ? (
          sessions.slice(0, 5).map((session) => (
            <a
              key={session.id}
              href={`/chat?session=${session.id}`}
              className="flex items-center gap-3 p-2 hover:bg-gruv-dark-4/20 rounded-xs transition-colors cursor-pointer"
              onClick={(event) => {
                event.preventDefault();
                window.location.href = `/chat?session=${session.id}`;
              }}
            >
              <div className="w-8 h-8 rounded-full bg-gruv-dark-4 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-gruv-light-1" />
              </div>
              <div className="flex-grow min-w-0">
                <p className="font-semibold text-xs truncate">{session.title || session.name || 'Untitled Session'}</p>
                <p className="text-[11px] text-gruv-light-4">{new Date(session.created_at).toLocaleDateString()} • {session.metadata?.message_count || 0} messages</p>
              </div>
            </a>
          ))
        ) : (
          <EmptyPane icon={MessageCircle} label="No recent activity" />
        )}
      </div>
    </div>
  );
}

function CoreActivityFeedCard({
  runs,
  failures,
  loading,
}: {
  runs: ExecutionRun[];
  failures: ExecutionRun[];
  loading: boolean;
}) {
  return (
    <div className="glass p-4 rounded-xs min-h-72 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <History className="text-monokai-orange w-4 h-4" />
          Core Activity Feed
        </h3>
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-gruv-light-4">{runs.length} visible runs</div>
          <Link
            to="/executions"
            className="px-3 py-2 rounded-xs bg-white/5 hover:bg-white/10 transition-colors text-xs font-semibold text-gruv-light-2"
          >
            Open Execution History
          </Link>
        </div>
      </div>
      {loading ? (
        <LoadingPane colorClassName="text-monokai-orange" />
      ) : runs.length > 0 ? (
        <div className="flex flex-col gap-2 overflow-y-auto">
          {failures.length > 0 && (
            <div className="rounded-xs border border-monokai-pink/20 bg-monokai-pink/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-monokai-pink">Latest Failure</p>
              <p className="mt-1 text-xs font-semibold text-gruv-light-1">{failures[0].action_type}</p>
              <p className="mt-1 text-[11px] text-gruv-light-3">{failures[0].source_type} • {failures[0].source_id}</p>
              {failures[0].error && <p className="mt-2 text-[11px] text-monokai-pink whitespace-pre-wrap">{failures[0].error}</p>}
            </div>
          )}
          {runs.slice(0, 6).map((run) => (
            <div key={run.id} className="rounded-xs border border-white/10 bg-gruv-dark-4/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gruv-light-1 truncate">{run.action_type}</p>
                  <p className="text-[11px] text-gruv-light-4 truncate">{run.source_type} • {run.source_id}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getRunStatusStyle(run.status)}`}>
                  {run.status}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-gruv-light-4">{new Date(run.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPane icon={History} label="No recent core activity" />
      )}
    </div>
  );
}

function McpProvidersCard({
  providers,
  loading,
}: {
  providers: McpProviderStatus[];
  loading: boolean;
}) {
  const summary = useMemo(() => {
    const installed = providers.filter((provider) => provider.status === 'installed').length;
    const failed = providers.filter((provider) => provider.status === 'failed').length;
    const disabled = providers.filter((provider) => provider.status === 'disabled').length;
    return { installed, failed, disabled };
  }, [providers]);

  return (
    <div className="glass p-4 rounded-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <PlugZap className="text-monokai-aqua w-4 h-4" />
            MCP Peripherals
          </h3>
          <p className="text-xs text-gruv-light-4 mt-1">Installed, disabled, and failed MCP providers as seen by stepbit-core.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <SummaryPill label={`${summary.installed} installed`} className="border-monokai-green/20 bg-monokai-green/10 text-monokai-green" />
          <SummaryPill label={`${summary.failed} failed`} className="border-monokai-pink/20 bg-monokai-pink/10 text-monokai-pink" />
          <SummaryPill label={`${summary.disabled} disabled`} className="border-white/10 bg-white/5 text-gruv-light-3" />
        </div>
      </div>

      {loading ? (
        <LoadingPane colorClassName="text-monokai-aqua" />
      ) : providers.length === 0 ? (
        <EmptyPane icon={PlugZap} label="No MCP provider data available" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {providers.map((provider) => {
            const tone =
              provider.status === 'installed'
                ? 'border-monokai-green/20 bg-monokai-green/5'
                : provider.status === 'failed'
                  ? 'border-monokai-pink/20 bg-monokai-pink/5'
                  : 'border-white/10 bg-white/5';

            return (
              <div key={provider.name} className={cn('rounded-xs border p-3', tone)}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gruv-light-1">{provider.name}</p>
                    <p className="text-[11px] text-gruv-light-4 mt-1">
                      {provider.enabled ? 'enabled' : 'disabled'} • {provider.status}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-[0.16em]',
                      provider.status === 'installed'
                        ? 'border-monokai-green/20 bg-monokai-green/15 text-monokai-green'
                        : provider.status === 'failed'
                          ? 'border-monokai-pink/20 bg-monokai-pink/15 text-monokai-pink'
                          : 'border-white/10 bg-white/5 text-gruv-light-3',
                    )}
                  >
                    {provider.status}
                  </span>
                </div>

                {provider.reason && (
                  <p className="mt-3 text-xs text-gruv-light-3 whitespace-pre-wrap">{provider.reason}</p>
                )}

                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Capabilities</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {provider.capabilities.length > 0 ? provider.capabilities.map((capability) => (
                        <SummaryPill key={capability} label={capability} className="border-monokai-aqua/20 bg-monokai-aqua/10 text-monokai-aqua" />
                      )) : (
                        <span className="text-xs text-gruv-light-4">No capabilities declared</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Installed Tools</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {provider.installed_tools.length > 0 ? provider.installed_tools.map((tool) => (
                        <SummaryPill key={tool} label={tool} className="border-monokai-orange/20 bg-monokai-orange/10 text-monokai-orange" />
                      )) : (
                        <span className="text-xs text-gruv-light-4">No tools installed</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ControlPlaneSummaryCard({
  core,
  providers,
  loading,
}: {
  core: ReturnType<typeof useStepbitCore>;
  providers: McpProviderStatus[];
  loading: boolean;
}) {
  const installedProviders = providers.filter((provider) => provider.status === 'installed').length;
  const failedProviders = providers.filter((provider) => provider.status === 'failed').length;

  return (
    <div className="glass p-4 rounded-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <CheckCircle2 className="text-monokai-aqua w-4 h-4" />
            Control Plane
          </h3>
          <p className="text-xs text-gruv-light-4 mt-1">
            Keep the dashboard summary-focused. Use the System view for detailed health checks, readiness blockers, runtime paths, and deeper troubleshooting.
          </p>
        </div>
        <Link
          to="/system"
          className="px-3 py-2 rounded-xs bg-monokai-aqua/10 border border-monokai-aqua/20 text-monokai-aqua hover:bg-monokai-aqua/15 transition-colors text-xs font-semibold"
        >
          Open System View
        </Link>
      </div>

      {loading ? (
        <LoadingPane colorClassName="text-monokai-aqua" />
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <RuntimeRow
            label="Core Status"
            value={core.online ? (core.ready ? 'Healthy & Ready' : 'Online, warming') : 'Offline'}
            accent={core.online ? (core.ready ? 'text-monokai-green' : 'text-monokai-orange') : 'text-monokai-pink'}
          />
          <RuntimeRow
            label="MCP Providers"
            value={`${installedProviders}/${providers.length || 0} installed`}
            accent={failedProviders === 0 ? 'text-monokai-green' : 'text-monokai-orange'}
          />
          <RuntimeRow
            label="Attention Needed"
            value={failedProviders > 0 ? `${failedProviders} provider issue(s)` : 'No immediate provider alerts'}
            accent={failedProviders > 0 ? 'text-monokai-orange' : 'text-monokai-green'}
          />
        </div>
      )}
    </div>
  );
}

function SummaryPill({ label, className }: { label: string; className: string }) {
  return <span className={cn('px-2 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-[0.14em]', className)}>{label}</span>;
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: StatCardColor;
  isLoading: boolean;
}) {
  return (
    <div className="glass p-4 rounded-xs flex flex-col gap-3 hover:border-gruv-light-4/50 transition-colors">
      <div className="flex justify-between items-start">
        <div className={cn('p-2 rounded-xs', {
          'bg-monokai-aqua/10 text-monokai-aqua': color === 'monokai-aqua',
          'bg-monokai-pink/10 text-monokai-pink': color === 'monokai-pink',
          'bg-monokai-purple/10 text-monokai-purple': color === 'monokai-purple',
          'bg-gruv-yellow/10 text-gruv-yellow': color === 'gruv-yellow',
          'bg-monokai-green/10 text-monokai-green': color === 'monokai-green',
          'bg-monokai-orange/10 text-monokai-orange': color === 'monokai-orange',
        })}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-gruv-light-4 text-[11px] font-semibold uppercase tracking-wider">{title}</p>
        {isLoading ? (
          <div className="h-7 flex items-center"><Loader2 className="w-4 h-4 animate-spin text-gruv-light-4" /></div>
        ) : (
          <h3 className="text-xl font-semibold mt-1">{value}</h3>
        )}
      </div>
    </div>
  );
}

function RuntimeRow({
  label,
  value,
  accent = 'text-gruv-light-1',
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xs border border-white/10 bg-gruv-dark-4/10 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
      <p className={`mt-1.5 text-xs font-semibold break-words ${accent}`}>{value}</p>
    </div>
  );
}

function InfoBox({
  icon: Icon,
  label,
  toneClassName,
  content,
  prewrap = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  toneClassName: string;
  content: string;
  prewrap?: boolean;
}) {
  return (
    <div className="rounded-xs border border-white/10 bg-gruv-dark-4/10 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${toneClassName}`} />
        <span className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</span>
      </div>
      <p className={cn('text-xs text-gruv-light-2', prewrap && 'whitespace-pre-wrap')}>{content}</p>
    </div>
  );
}

function OpsCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className={`rounded-xs border p-4 ${OPS_CARD_TONES[tone]}`}>
      <p className="text-[10px] uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="mt-2 text-xs text-gruv-light-2">{detail}</p>
    </div>
  );
}

function LoadingPane({ colorClassName }: { colorClassName: string }) {
  return (
    <div className="flex justify-center p-8">
      <Loader2 className={`animate-spin ${colorClassName}`} />
    </div>
  );
}

function EmptyPane({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex-grow flex flex-col items-center justify-center text-gruv-light-4 opacity-50">
      <Icon className="w-8 h-8 mb-2 opacity-20" />
      <p className="text-xs font-mono">{label}</p>
    </div>
  );
}

function buildRuntimeSummary(core: StepbitCoreStatus & { loading: boolean; refresh: () => Promise<void> }, runs: ExecutionRun[]) {
  const coreRuns = runs.filter((run) => CORE_RUN_SOURCE_TYPES.includes(run.source_type));
  const recentFailures = coreRuns.filter((run) => run.status === 'failed').slice(0, 4);

  const readiness = !core.online
    ? {
        label: 'Offline',
        tone: 'pink' as Tone,
        detail: core.message,
      }
    : core.ready
      ? {
          label: 'Ready',
          tone: 'green' as Tone,
          detail: core.message,
        }
      : {
          label: 'Warming',
          tone: 'orange' as Tone,
          detail: core.message,
        };

  const pressureLevel = !core.online
    ? 'unknown'
    : core.metrics.active_sessions > 8 || core.metrics.token_latency_avg_ms > 500
      ? 'high'
      : core.metrics.active_sessions > 3 || core.metrics.token_latency_avg_ms > 250
        ? 'moderate'
        : 'low';

  const pressure = {
    label: pressureLevel.toUpperCase(),
    tone: getPressureTone(pressureLevel),
    detail: `Active sessions: ${formatNumber(core.metrics.active_sessions || 0)} • Avg latency: ${(core.metrics.token_latency_avg_ms || 0).toFixed(1)} ms`,
  };

  return {
    readiness,
    pressure,
    coreRuns,
    recentFailures,
  };
}

function getRunStatusStyle(status: string) {
  if (status === 'completed') return STATUS_STYLES.completed;
  if (status === 'failed') return STATUS_STYLES.failed;
  return STATUS_STYLES.running;
}

function getPressureTone(level: 'low' | 'moderate' | 'high' | 'unknown'): Tone {
  if (level === 'low') return 'green';
  if (level === 'moderate') return 'orange';
  if (level === 'high') return 'pink';
  return 'gray';
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
}

function formatNumber(value: number) {
  if (!value) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}
