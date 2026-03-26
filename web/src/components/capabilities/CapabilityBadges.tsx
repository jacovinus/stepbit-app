import React from 'react';

type ToolBadgeProps = {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
};

const toneClasses: Record<NonNullable<ToolBadgeProps['tone']>, string> = {
  neutral: 'border-white/10 bg-white/5 text-gruv-light-3',
  accent: 'border-monokai-aqua/20 bg-monokai-aqua/10 text-monokai-aqua',
  success: 'border-monokai-green/20 bg-monokai-green/10 text-monokai-green',
  warning: 'border-monokai-orange/20 bg-monokai-orange/10 text-monokai-orange',
  danger: 'border-monokai-pink/20 bg-monokai-pink/10 text-monokai-pink',
};

export const CapabilityBadge: React.FC<ToolBadgeProps> = ({ label, tone = 'neutral' }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClasses[tone]}`}
  >
    {label}
  </span>
);

export const ToolCapabilityBadges: React.FC<{
  readOnly?: boolean;
  openWorld?: boolean;
  destructive?: boolean;
  tags?: string[];
}> = ({ readOnly, openWorld, destructive, tags = [] }) => (
  <div className="flex flex-wrap gap-2">
    {typeof readOnly === 'boolean' && (
      <CapabilityBadge label={readOnly ? 'Read only' : 'Mutating'} tone={readOnly ? 'success' : 'warning'} />
    )}
    {openWorld ? <CapabilityBadge label="Open world" tone="accent" /> : null}
    {destructive ? <CapabilityBadge label="Destructive" tone="danger" /> : null}
    {tags.map((tag) => (
      <CapabilityBadge key={tag} label={tag} />
    ))}
  </div>
);

export const ProviderSummaryBadges: React.FC<{
  scope?: string;
  toolCount?: number;
  providerType?: string;
}> = ({ scope, toolCount, providerType }) => (
  <div className="flex flex-wrap gap-2">
    {scope ? <CapabilityBadge label={scope} tone="accent" /> : null}
    {providerType ? <CapabilityBadge label={providerType} /> : null}
    {typeof toolCount === 'number' ? <CapabilityBadge label={`${toolCount} tools`} tone="success" /> : null}
  </div>
);
