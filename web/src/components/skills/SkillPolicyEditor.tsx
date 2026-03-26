import React from 'react';
import type { SkillPolicy } from '../../api/skills';

const TOOL_OPTIONS = [
  'internet_search',
  'read_url',
  'read_full_content',
  'current_date',
  'current_time',
  'timezone_time',
];

const OUTPUT_OPTIONS = ['table', 'concise', 'markdown', 'chart', 'svg'];
const CITATION_OPTIONS = ['none', 'required', 'tool_required'];

type Props = {
  value: SkillPolicy;
  onChange: (next: SkillPolicy) => void;
};

function toggleValue(values: string[] | undefined, value: string): string[] {
  const current = values || [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export const SkillPolicyEditor: React.FC<Props> = ({ value, onChange }) => (
  <div className="space-y-4 rounded-xs border border-white/10 bg-gruv-dark-0/40 p-4">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gruv-light-4">Structured Policy</p>
      <p className="mt-1 text-xs text-gruv-light-4">Define what the skill enables and how answers should be shaped. This is persisted separately from the freeform Markdown content.</p>
    </div>

    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-gruv-light-4">Description</label>
      <input
        value={value.description || ''}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        placeholder="e.g. Research policy for live web questions"
        className="w-full bg-gruv-dark-2 border border-gruv-dark-4/30 rounded-xs px-4 py-2.5 text-gruv-light-1 placeholder:text-gruv-dark-4 focus:outline-none focus:border-monokai-aqua/60 transition-colors"
      />
    </div>

    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-gruv-light-4">Allowed Tools</label>
      <div className="flex flex-wrap gap-2">
        {TOOL_OPTIONS.map((tool) => {
          const selected = (value.allowed_tools || []).includes(tool);
          return (
            <button
              key={tool}
              type="button"
              onClick={() => onChange({ ...value, allowed_tools: toggleValue(value.allowed_tools, tool) })}
              className={`px-3 py-2 rounded-xs border text-xs font-semibold transition-colors ${
                selected
                  ? 'border-monokai-aqua/40 bg-monokai-aqua/15 text-monokai-aqua'
                  : 'border-white/10 bg-white/5 text-gruv-light-3'
              }`}
            >
              {tool}
            </button>
          );
        })}
      </div>
    </div>

    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-gruv-light-4">Citation Policy</label>
      <select
        value={value.citation_policy || 'none'}
        onChange={(e) => onChange({ ...value, citation_policy: e.target.value })}
        className="w-full bg-gruv-dark-2 border border-gruv-dark-4/30 rounded-xs px-4 py-2.5 text-gruv-light-1 focus:outline-none focus:border-monokai-aqua/60 transition-colors"
      >
        {CITATION_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>

    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-gruv-light-4">Preferred Outputs</label>
      <div className="flex flex-wrap gap-2">
        {OUTPUT_OPTIONS.map((output) => {
          const selected = (value.preferred_outputs || []).includes(output);
          return (
            <button
              key={output}
              type="button"
              onClick={() => onChange({ ...value, preferred_outputs: toggleValue(value.preferred_outputs, output) })}
              className={`px-3 py-2 rounded-xs border text-xs font-semibold transition-colors ${
                selected
                  ? 'border-monokai-purple/40 bg-monokai-purple/15 text-monokai-purple'
                  : 'border-white/10 bg-white/5 text-gruv-light-3'
              }`}
            >
              {output}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
