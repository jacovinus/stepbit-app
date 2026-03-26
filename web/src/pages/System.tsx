import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock3, Cpu, Loader2, PlugZap, ShieldCheck, Siren, Timer } from 'lucide-react';
import { fetchMcpProviderDoc, getCoreCronStatus, getCoreHealthReport, getCoreReadinessReport, getCoreRecentEvents, getCoreSystemRuntime, getMcpProviders, updateMcpProviderState } from '../api/llm';
import { pipelinesApi } from '../api/pipelines';
import type { CoreCheck, CoreRecentEvent, StepbitCoreStatus } from '../types';
import { cn } from '../utils/cn';
import { CapabilityInventoryPanel } from '../components/system/CapabilityInventoryPanel';

export function System() {
  const [selectedProviderName, setSelectedProviderName] = useState<string>('');
  const queryClient = useQueryClient();
  const { data: coreStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['system-core-status'],
    queryFn: () => pipelinesApi.getStepbitCoreStatus(),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: healthReport, isLoading: healthLoading } = useQuery({
    queryKey: ['system-core-health'],
    queryFn: () => getCoreHealthReport(),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: readinessReport, isLoading: readinessLoading } = useQuery({
    queryKey: ['system-core-readiness'],
    queryFn: () => getCoreReadinessReport(),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: ['system-mcp-providers'],
    queryFn: () => getMcpProviders(),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: systemRuntime, isLoading: runtimeLoading } = useQuery({
    queryKey: ['system-runtime'],
    queryFn: () => getCoreSystemRuntime(),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: cronStatus, isLoading: cronLoading } = useQuery({
    queryKey: ['system-cron-status'],
    queryFn: () => getCoreCronStatus(),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: recentEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['system-recent-events'],
    queryFn: () => getCoreRecentEvents(12),
    refetchInterval: 10000,
    retry: false,
  });

  const combinedChecks = useMemo(
    () => [...(healthReport?.checks ?? []), ...(readinessReport?.checks ?? [])],
    [healthReport?.checks, readinessReport?.checks],
  );
  const selectedProvider = useMemo(() => {
    const providerList = providers ?? [];
    return providerList.find((provider) => provider.name === selectedProviderName)
      || providerList.find((provider) => (provider.planned_tools?.length ?? 0) > 0)
      || providerList[0]
      || null;
  }, [providers, selectedProviderName]);
  const { data: selectedProviderDoc, isLoading: selectedProviderDocLoading } = useQuery({
    queryKey: ['system-provider-doc', selectedProvider?.name],
    queryFn: () => fetchMcpProviderDoc(selectedProvider!.name),
    enabled: Boolean(selectedProvider?.name),
    refetchInterval: 10000,
    retry: false,
  });
  const providerStateMutation = useMutation({
    mutationFn: ({ provider, enabled }: { provider: string; enabled: boolean }) =>
      updateMcpProviderState(provider, enabled),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['system-mcp-providers'] }),
        queryClient.invalidateQueries({ queryKey: ['system-core-readiness'] }),
        queryClient.invalidateQueries({ queryKey: ['system-runtime'] }),
      ]);
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-monokai-aqua" />
            System Control Plane
          </h1>
          <p className="text-xs text-gruv-light-4 mt-1">
            Dedicated operational view for stepbit-core health, readiness, provider state, and runtime pressure.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <StatusPill
            label={`health: ${healthReport?.status ?? 'unknown'}`}
            className={healthReport?.ok ? 'border-monokai-green/20 bg-monokai-green/10 text-monokai-green' : 'border-monokai-pink/20 bg-monokai-pink/10 text-monokai-pink'}
          />
          <StatusPill
            label={`readiness: ${readinessReport?.status ?? 'unknown'}`}
            className={readinessReport?.ready ? 'border-monokai-green/20 bg-monokai-green/10 text-monokai-green' : 'border-monokai-orange/20 bg-monokai-orange/10 text-monokai-orange'}
          />
          <StatusPill
            label={`providers: ${Array.isArray(providers) ? providers.length : 0}`}
            className="border-monokai-aqua/20 bg-monokai-aqua/10 text-monokai-aqua"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          label="Connectivity"
          value={coreStatus?.online ? 'Online' : 'Offline'}
          detail={coreStatus?.message ?? 'No status available'}
          tone={coreStatus?.online ? 'green' : 'pink'}
          icon={Cpu}
          loading={statusLoading}
        />
        <MetricCard
          label="Models"
          value={readinessReport ? `${readinessReport.context.loaded_models}/${readinessReport.context.models_on_disk}` : 'n/a'}
          detail="loaded / on disk"
          tone={(readinessReport?.context.loaded_models ?? 0) > 0 ? 'green' : 'orange'}
          icon={Activity}
          loading={readinessLoading}
        />
        <MetricCard
          label="MCP Providers"
          value={readinessReport ? `${readinessReport.context.mcp_installed}/${readinessReport.context.mcp_enabled}` : 'n/a'}
          detail="installed / enabled"
          tone={readinessReport && readinessReport.context.mcp_installed === readinessReport.context.mcp_enabled ? 'green' : 'orange'}
          icon={PlugZap}
          loading={readinessLoading}
        />
        <MetricCard
          label="Runtime Pressure"
          value={formatPressure(coreStatus)}
          detail={coreStatus ? `${(coreStatus.metrics.token_latency_avg_ms ?? 0).toFixed(1)} ms avg latency` : 'No metrics yet'}
          tone={getPressureTone(coreStatus)}
          icon={Timer}
          loading={statusLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          label="Cron Jobs"
          value={cronStatus ? String(cronStatus.total_jobs) : 'n/a'}
          detail={cronStatus ? `${cronStatus.retrying_jobs} retrying` : 'No cron telemetry'}
          tone={(cronStatus?.failing_jobs ?? 0) > 0 ? 'orange' : 'green'}
          icon={Clock3}
          loading={cronLoading}
        />
        <MetricCard
          label="Triggers"
          value={systemRuntime ? String(systemRuntime.trigger_count) : 'n/a'}
          detail="registered trigger definitions"
          tone={(systemRuntime?.trigger_count ?? 0) > 0 ? 'green' : 'aqua'}
          icon={Siren}
          loading={runtimeLoading}
        />
        <MetricCard
          label="Temp Resources"
          value={systemRuntime ? String(systemRuntime.temp.registered_resources) : 'n/a'}
          detail={systemRuntime ? formatBytes(systemRuntime.temp.total_size_bytes) : 'No runtime telemetry'}
          tone={getTempTone(systemRuntime?.temp.pressure_level)}
          icon={Activity}
          loading={runtimeLoading}
        />
        <MetricCard
          label="Temp Pressure"
          value={systemRuntime?.temp.pressure_level ?? 'n/a'}
          detail={systemRuntime ? `${systemRuntime.temp.global_usage_files}/${systemRuntime.temp.global_max_files} files` : 'No runtime telemetry'}
          tone={getTempTone(systemRuntime?.temp.pressure_level)}
          icon={Timer}
          loading={runtimeLoading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="glass rounded-xs p-4">
          <SectionHeader icon={Siren} title="Readiness Reasons" subtitle="Anything blocking core readiness right now." />
          {readinessLoading ? (
            <LoadingPane />
          ) : readinessReport?.reasons?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {readinessReport.reasons.map((reason) => (
                <StatusPill key={reason} label={reason} className="border-monokai-orange/20 bg-monokai-orange/10 text-monokai-orange" />
              ))}
            </div>
          ) : (
            <EmptyMessage message="No blocking reasons reported." />
          )}
        </div>

        <div className="glass rounded-xs p-4">
          <SectionHeader icon={Cpu} title="Runtime Context" subtitle="Read-only paths and runtime counters returned by stepbit-core." />
          {runtimeLoading || !systemRuntime ? (
            <LoadingPane />
          ) : (
            <div className="mt-4 space-y-2">
              <ContextRow label="State Dir" value={systemRuntime.state_dir} />
              <ContextRow label="Cron DB" value={systemRuntime.cron_db_path} />
              <ContextRow label="Events DB" value={systemRuntime.events_db_path} />
              <ContextRow label="Cron Scheduler" value={systemRuntime.scheduler_active ? 'Running' : 'Disabled'} accent={systemRuntime.scheduler_active ? 'text-monokai-green' : 'text-gruv-light-3'} />
              <ContextRow label="Temp Usage" value={`${formatBytes(systemRuntime.temp.global_usage_bytes)} / ${formatBytes(systemRuntime.temp.global_max_bytes)}`} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
        <div className="glass rounded-xs p-4">
          <SectionHeader icon={Clock3} title="Cron Runtime" subtitle="Live scheduler health and retry pressure from stepbit-core." />
          {cronLoading || !cronStatus ? (
            <LoadingPane />
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <ContextRow label="Scheduler" value={cronStatus.scheduler_running ? 'Running' : 'Stopped'} accent={cronStatus.scheduler_running ? 'text-monokai-green' : 'text-monokai-pink'} />
              <ContextRow label="Total Jobs" value={String(cronStatus.total_jobs)} />
              <ContextRow label="Failing Jobs" value={String(cronStatus.failing_jobs)} accent={cronStatus.failing_jobs > 0 ? 'text-monokai-orange' : 'text-monokai-green'} />
              <ContextRow label="Retry Queue" value={String(cronStatus.retrying_jobs)} accent={cronStatus.retrying_jobs > 0 ? 'text-monokai-orange' : 'text-monokai-green'} />
            </div>
          )}
        </div>

        <div className="glass rounded-xs p-4">
          <SectionHeader icon={Activity} title="Recent Events" subtitle="Latest persisted events published through the core event bus." />
          {eventsLoading ? (
            <LoadingPane />
          ) : !recentEvents?.length ? (
            <EmptyMessage message="No recent events available." />
          ) : (
            <div className="mt-4 space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {recentEvents.map((event) => (
                <RecentEventTile key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-xs p-4">
        <SectionHeader icon={CheckCircle2} title="Health Checks" subtitle="Combined liveness and readiness checks from stepbit-core." />
        {healthLoading || readinessLoading ? (
          <LoadingPane />
        ) : combinedChecks.length === 0 ? (
          <EmptyMessage message="No check data available." />
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {combinedChecks.map((check, index) => (
              <HealthCheckTile key={`${check.name}-${index}`} check={check} />
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-xs p-4">
        <SectionHeader icon={PlugZap} title="Connected Capabilities" subtitle="What this AI can use right now, and how each provider is enabled." />
        <CapabilityInventoryPanel
          providers={providers}
          loading={providersLoading}
          selectedProviderName={selectedProviderName}
          onSelect={setSelectedProviderName}
          selectedProviderDoc={selectedProviderDoc}
          selectedProviderDocLoading={selectedProviderDocLoading}
          isMutatingFor={(providerName) => providerStateMutation.isPending && providerStateMutation.variables?.provider === providerName}
          onToggleExternal={(providerName, enabled) => providerStateMutation.mutate({ provider: providerName, enabled })}
        />
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold flex items-center gap-2">
        <Icon className="w-4 h-4 text-monokai-aqua" />
        {title}
      </h2>
      <p className="text-xs text-gruv-light-4 mt-1">{subtitle}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'orange' | 'pink' | 'aqua';
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  const toneClass = {
    green: 'text-monokai-green bg-monokai-green/10',
    orange: 'text-monokai-orange bg-monokai-orange/10',
    pink: 'text-monokai-pink bg-monokai-pink/10',
    aqua: 'text-monokai-aqua bg-monokai-aqua/10',
  }[tone];

  return (
    <div className="glass rounded-xs p-4">
      <div className="flex items-start justify-between gap-3">
        <div className={cn('rounded-xs p-2', toneClass)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
      {loading ? (
        <div className="mt-2"><Loader2 className="w-4 h-4 animate-spin text-gruv-light-4" /></div>
      ) : (
        <>
          <p className="mt-2 text-xl font-semibold text-gruv-light-1">{value}</p>
          <p className="mt-1 text-xs text-gruv-light-4">{detail}</p>
        </>
      )}
    </div>
  );
}

function HealthCheckTile({ check }: { check: CoreCheck }) {
  return (
    <div className={cn('rounded-xs border p-3', check.ok ? 'border-monokai-green/20 bg-monokai-green/5' : 'border-monokai-pink/20 bg-monokai-pink/5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gruv-light-1">{check.name}</p>
          {check.detail && <p className="mt-1 text-[11px] text-gruv-light-3 break-all">{check.detail}</p>}
        </div>
        <StatusPill
          label={check.ok ? 'ok' : 'fail'}
          className={check.ok ? 'border-monokai-green/20 bg-monokai-green/15 text-monokai-green' : 'border-monokai-pink/20 bg-monokai-pink/15 text-monokai-pink'}
        />
      </div>
    </div>
  );
}

function RecentEventTile({ event }: { event: CoreRecentEvent }) {
  return (
    <div className="rounded-xs border border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gruv-light-1">{event.event_type}</p>
          <p className="mt-1 text-[11px] text-gruv-light-4 break-all">{event.id}</p>
          <p className="mt-1 text-[11px] text-gruv-light-4">{new Date(event.timestamp).toLocaleString()}</p>
        </div>
        {event.source_node && (
          <StatusPill label={event.source_node} className="border-monokai-purple/20 bg-monokai-purple/10 text-monokai-purple" />
        )}
      </div>
      <pre className="mt-3 text-[11px] text-gruv-light-3 whitespace-pre-wrap break-all overflow-x-auto">
        {JSON.stringify(event.payload, null, 2)}
      </pre>
    </div>
  );
}

function ContextRow({ label, value, accent = 'text-gruv-light-1' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xs border border-white/10 bg-gruv-dark-4/10 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
      <p className={`mt-1.5 text-xs font-semibold break-all ${accent}`}>{value}</p>
    </div>
  );
}

function StatusPill({ label, className }: { label: string; className: string }) {
  return <span className={cn('px-2 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-[0.14em]', className)}>{label}</span>;
}

function LoadingPane() {
  return (
    <div className="flex justify-center p-8">
      <Loader2 className="w-5 h-5 animate-spin text-monokai-aqua" />
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return <p className="mt-4 text-xs text-gruv-light-4">{message}</p>;
}

function formatPressure(coreStatus?: StepbitCoreStatus) {
  if (!coreStatus?.online) return 'OFFLINE';
  if ((coreStatus.metrics.active_sessions ?? 0) > 8 || (coreStatus.metrics.token_latency_avg_ms ?? 0) > 500) return 'HIGH';
  if ((coreStatus.metrics.active_sessions ?? 0) > 3 || (coreStatus.metrics.token_latency_avg_ms ?? 0) > 250) return 'MODERATE';
  return 'LOW';
}

function getPressureTone(coreStatus?: StepbitCoreStatus): 'green' | 'orange' | 'pink' | 'aqua' {
  const pressure = formatPressure(coreStatus);
  if (pressure === 'HIGH') return 'pink';
  if (pressure === 'MODERATE') return 'orange';
  if (pressure === 'LOW') return 'green';
  return 'aqua';
}

function getTempTone(level?: string): 'green' | 'orange' | 'pink' | 'aqua' {
  if (!level) return 'aqua';
  const normalized = level.toLowerCase();
  if (normalized === 'critical') return 'pink';
  if (normalized === 'high') return 'orange';
  if (normalized === 'normal') return 'green';
  return 'aqua';
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
}
