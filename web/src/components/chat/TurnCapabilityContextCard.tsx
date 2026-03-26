import React from 'react';
import type { TurnCapabilityContext } from '../../types';
import { CapabilityBadge, ToolCapabilityBadges } from '../capabilities/CapabilityBadges';

type Props = {
  context?: TurnCapabilityContext;
};

export const TurnCapabilityContextCard: React.FC<Props> = ({ context }) => {
  if (!context) return null;

  const providerSet = new Set(context.available_tools.map((tool) => tool.provider_id));
  const usedTools = context.available_tools.filter((tool) => context.used_tools.includes(tool.name));
  const autoSafeCount = usedTools.filter((tool) => tool.read_only && !tool.open_world).length;
  const reviewSuggestedCount = usedTools.filter((tool) => !tool.read_only || tool.open_world).length;

  return (
    <div className="mt-3 rounded-xs border border-white/10 bg-black/20 p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <CapabilityBadge label={context.search_enabled ? 'search on' : 'search off'} tone={context.search_enabled ? 'accent' : 'neutral'} />
        <CapabilityBadge label={context.reason_enabled ? 'reason on' : 'reason off'} tone={context.reason_enabled ? 'warning' : 'neutral'} />
        <CapabilityBadge label={`${providerSet.size} providers`} tone="success" />
        <CapabilityBadge label={`${context.available_tools.length} available tools`} />
        {autoSafeCount > 0 ? <CapabilityBadge label={`${autoSafeCount} auto-safe`} tone="success" /> : null}
        {reviewSuggestedCount > 0 ? <CapabilityBadge label={`${reviewSuggestedCount} review suggested`} tone="warning" /> : null}
      </div>

      {usedTools.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gruv-light-4">Used this turn</p>
          <div className="space-y-2">
            {usedTools.map((tool) => (
              <div key={tool.name} className="rounded-lg border border-white/5 bg-black/10 p-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <CapabilityBadge label={tool.name} tone="accent" />
                  <CapabilityBadge label={tool.provider_id} tone="neutral" />
                </div>
                <ToolCapabilityBadges readOnly={tool.read_only} openWorld={tool.open_world} tags={tool.tags} />
              </div>
            ))}
          </div>
        </div>
      )}

      {context.requested_tools.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gruv-light-4">Requested tools</p>
          <div className="flex flex-wrap gap-2">
            {context.requested_tools.map((tool) => (
              <CapabilityBadge key={tool} label={tool} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
