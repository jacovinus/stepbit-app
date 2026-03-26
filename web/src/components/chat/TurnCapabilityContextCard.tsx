import React from 'react';
import type { TurnCapabilityContext } from '../../types';
import { CapabilityBadge } from '../capabilities/CapabilityBadges';

type Props = {
  context?: TurnCapabilityContext;
};

export const TurnCapabilityContextCard: React.FC<Props> = ({ context }) => {
  if (!context) return null;

  const providerSet = new Set(context.available_tools.map((tool) => tool.provider_id));

  return (
    <div className="mt-3 rounded-xs border border-white/10 bg-black/20 p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <CapabilityBadge label={context.search_enabled ? 'search on' : 'search off'} tone={context.search_enabled ? 'accent' : 'neutral'} />
        <CapabilityBadge label={context.reason_enabled ? 'reason on' : 'reason off'} tone={context.reason_enabled ? 'warning' : 'neutral'} />
        <CapabilityBadge label={`${providerSet.size} providers`} tone="success" />
        <CapabilityBadge label={`${context.available_tools.length} available tools`} />
      </div>

      {context.used_tools.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gruv-light-4">Used this turn</p>
          <div className="flex flex-wrap gap-2">
            {context.used_tools.map((tool) => (
              <CapabilityBadge key={tool} label={tool} tone="accent" />
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
