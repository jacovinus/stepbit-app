import React from 'react';
import type { SkillPolicy } from '../../api/skills';
import { CapabilityBadge } from '../capabilities/CapabilityBadges';

export const SkillPolicySummary: React.FC<{ policy?: SkillPolicy }> = ({ policy }) => {
  if (!policy) return null;

  const hasContent =
    !!policy.description ||
    (policy.allowed_tools && policy.allowed_tools.length > 0) ||
    !!policy.citation_policy ||
    (policy.preferred_outputs && policy.preferred_outputs.length > 0);
  if (!hasContent) return null;

  return (
    <div className="space-y-2 rounded-xs border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Policy</p>
      {policy.description ? <p className="text-xs text-gruv-light-3">{policy.description}</p> : null}
      <div className="flex flex-wrap gap-2">
        {(policy.allowed_tools || []).map((tool) => (
          <CapabilityBadge key={tool} label={tool} tone="accent" />
        ))}
        {policy.citation_policy ? <CapabilityBadge label={`citations:${policy.citation_policy}`} tone="success" /> : null}
        {(policy.preferred_outputs || []).map((output) => (
          <CapabilityBadge key={output} label={output} />
        ))}
      </div>
    </div>
  );
};
