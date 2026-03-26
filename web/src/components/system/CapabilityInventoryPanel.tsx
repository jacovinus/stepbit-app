import { Loader2 } from 'lucide-react';
import { MarkdownContent } from '../MarkdownContent';
import type { McpProviderStatus } from '../../types';
import { cn } from '../../utils/cn';

export function CapabilityInventoryPanel({
  providers,
  loading,
  selectedProviderName,
  onSelect,
  selectedProviderDoc,
  selectedProviderDocLoading,
  isMutatingFor,
  onToggleExternal,
}: {
  providers?: McpProviderStatus[];
  loading: boolean;
  selectedProviderName: string;
  onSelect: (name: string) => void;
  selectedProviderDoc?: string;
  selectedProviderDocLoading: boolean;
  isMutatingFor: (providerName: string) => boolean;
  onToggleExternal: (providerName: string, enabled: boolean) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-monokai-aqua" />
      </div>
    );
  }

  if (!providers?.length) {
    return <p className="mt-4 text-xs text-gruv-light-4">No provider data available.</p>;
  }

  const sortedProviders = [...providers].sort(
    (left, right) =>
      providerRank(left) - providerRank(right) || providerTitle(left).localeCompare(providerTitle(right)),
  );
  const selectedProvider =
    sortedProviders.find((provider) => provider.name === selectedProviderName) ??
    sortedProviders[0];

  const availableNow = sortedProviders.filter((provider) => provider.status === 'installed' && provider.enabled).length;
  const disabledCount = sortedProviders.filter((provider) => provider.status === 'disabled' || !provider.enabled).length;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <InventoryBadge label={`${availableNow} available now`} tone="green" />
        <InventoryBadge label={`${disabledCount} disabled`} tone="slate" />
        <InventoryBadge label={`${sortedProviders.length} total providers`} tone="aqua" />
      </div>

      <div className="rounded-xs border border-white/10 overflow-hidden">
        {sortedProviders.map((provider, index) => (
          <ProviderRow
            key={provider.name}
            provider={provider}
            selected={provider.name === selectedProvider.name}
            onSelect={onSelect}
            isMutating={isMutatingFor(provider.name)}
            onToggleExternal={onToggleExternal}
            withBorder={index < sortedProviders.length - 1}
          />
        ))}
      </div>

      <ProviderDetails
        provider={selectedProvider}
        providerDoc={selectedProviderDoc}
        providerDocLoading={selectedProviderDocLoading}
      />
    </div>
  );
}

function ProviderRow({
  provider,
  selected,
  onSelect,
  isMutating,
  onToggleExternal,
  withBorder,
}: {
  provider: McpProviderStatus;
  selected: boolean;
  onSelect: (name: string) => void;
  isMutating: boolean;
  onToggleExternal: (providerName: string, enabled: boolean) => void;
  withBorder: boolean;
}) {
  const topActions = provider.installed_tools.length > 0 ? provider.installed_tools : provider.planned_tools ?? [];

  return (
    <div
      className={cn(
        'p-4 transition-colors',
        withBorder && 'border-b border-white/10',
        selected ? 'bg-monokai-aqua/5' : 'bg-transparent',
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button type="button" onClick={() => onSelect(provider.name)} className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gruv-light-1">{providerTitle(provider)}</p>
            <StateBadge status={provider.status} />
            {provider.scope && <InventoryBadge label={provider.scope} tone="slate" />}
          </div>
          <p className="mt-1 text-xs text-gruv-light-3">{provider.summary || providerFallbackSummary(provider)}</p>
          <p className="mt-2 text-[11px] text-gruv-light-4">
            {provider.supports_toggle ? 'Managed from the app' : 'Managed from core config'}
            {provider.activation_key ? ` • key: ${provider.activation_key}` : ''}
          </p>
        </button>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          {provider.supports_toggle ? (
            <button
              type="button"
              onClick={() => onToggleExternal(provider.name, !provider.enabled)}
              disabled={isMutating}
              className={cn(
                'rounded-xs border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
                provider.enabled
                  ? 'border-monokai-orange/30 bg-monokai-orange/10 text-monokai-orange hover:bg-monokai-orange/15'
                  : 'border-monokai-green/30 bg-monokai-green/10 text-monokai-green hover:bg-monokai-green/15',
                isMutating && 'cursor-wait opacity-70',
              )}
            >
              {isMutating ? 'Updating…' : provider.enabled ? 'Disable Plugin' : 'Enable Plugin'}
            </button>
          ) : (
            <InventoryBadge label="config" tone="slate" />
          )}
          <div className="flex flex-wrap gap-1.5">
            {topActions.slice(0, 3).map((tool) => (
              <InventoryBadge key={tool} label={humanizeIdentifier(tool)} tone="aqua" />
            ))}
            {topActions.length > 3 && <InventoryBadge label={`+${topActions.length - 3} more`} tone="slate" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderDetails({
  provider,
  providerDoc,
  providerDocLoading,
}: {
  provider: McpProviderStatus;
  providerDoc?: string;
  providerDocLoading: boolean;
}) {
  return (
    <div className="rounded-xs border border-monokai-aqua/20 bg-monokai-aqua/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Selected capability provider</p>
          <h3 className="mt-2 text-base font-semibold text-gruv-light-1">{providerTitle(provider)}</h3>
          <p className="mt-1 text-xs text-gruv-light-3">{provider.summary || providerFallbackSummary(provider)}</p>
        </div>
        <StateBadge status={provider.status} />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <DetailCard label="How to activate" value={provider.activation_hint || providerFallbackActivation(provider)} />
        <DetailCard
          label="Control surface"
          value={provider.supports_toggle ? 'Stepbit App toggle' : provider.activation_target ?? 'stepbit-core config'}
        />
        <DetailCard
          label="Provider key"
          value={provider.activation_key ?? provider.name}
        />
        <DetailCard
          label="Available actions"
          value={(provider.installed_tools.length > 0 ? provider.installed_tools : provider.planned_tools ?? [])
            .map(humanizeIdentifier)
            .join(', ') || 'None'}
        />
      </div>

      {provider.reason && (
        <div className="mt-4 rounded-xs border border-monokai-orange/20 bg-monokai-orange/10 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-monokai-orange">Status detail</p>
          <p className="mt-2 text-xs text-gruv-light-2 whitespace-pre-wrap">{provider.reason}</p>
        </div>
      )}

      <div className="mt-4 rounded-xs border border-white/10 bg-black/10 p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Provider guide</p>
        {providerDocLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="w-5 h-5 animate-spin text-monokai-aqua" />
          </div>
        ) : providerDoc ? (
          <div className="mt-3 max-h-[280px] overflow-y-auto pr-2">
            <MarkdownContent content={providerDoc} />
          </div>
        ) : (
          <p className="mt-4 text-xs text-gruv-light-4">No provider guide available.</p>
        )}
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xs border border-white/10 bg-gruv-dark-4/10 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
      <p className="mt-1.5 text-xs font-semibold break-words text-gruv-light-1">{value}</p>
    </div>
  );
}

function InventoryBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'green' | 'slate' | 'aqua';
}) {
  const toneClass = {
    green: 'border-monokai-green/20 bg-monokai-green/15 text-monokai-green',
    slate: 'border-white/10 bg-white/5 text-gruv-light-3',
    aqua: 'border-monokai-aqua/20 bg-monokai-aqua/10 text-monokai-aqua',
  }[tone];

  return <span className={cn('rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', toneClass)}>{label}</span>;
}

function StateBadge({ status }: { status: string }) {
  const toneClass =
    status === 'installed'
      ? 'border-monokai-green/20 bg-monokai-green/15 text-monokai-green'
      : status === 'failed'
        ? 'border-monokai-pink/20 bg-monokai-pink/15 text-monokai-pink'
        : 'border-white/10 bg-white/5 text-gruv-light-3';
  return <span className={cn('rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', toneClass)}>{status}</span>;
}

function providerRank(provider: McpProviderStatus) {
  if (provider.status === 'installed' && provider.enabled) return 0;
  if (provider.supports_toggle) return 1;
  if (provider.status === 'disabled') return 2;
  return 3;
}

function providerTitle(provider: McpProviderStatus) {
  return provider.title || humanizeIdentifier(provider.name);
}

function providerFallbackSummary(provider: McpProviderStatus) {
  return provider.supports_toggle
    ? 'External plugin exposed through the MCP control plane.'
    : 'Built-in capability provider managed by stepbit-core.';
}

function providerFallbackActivation(provider: McpProviderStatus) {
  return provider.supports_toggle
    ? 'Use the Enable/Disable Plugin action in the app to change this provider.'
    : `Add "${provider.name}" to stepbit-core/config/mcp_providers.json and restart stepbit-core.`;
}

function humanizeIdentifier(value: string) {
  return value
    .split(/[_:-]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}
