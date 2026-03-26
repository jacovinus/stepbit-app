import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Check, ChevronDown, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { skillsApi, type Skill } from '../../api/skills';

interface SkillsSelectorProps {
  selected: Skill[];
  onChange: (skills: Skill[]) => void;
}

export const SkillsSelector = ({ selected, onChange }: SkillsSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const { data: allSkills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: () => skillsApi.list(),
  });

  const filtered = allSkills.filter((skill) => {
    const q = search.toLowerCase();
    return !q || skill.name.toLowerCase().includes(q) || skill.tags.toLowerCase().includes(q);
  });

  const isSelected = (id: number) => selected.some((skill) => skill.id === id);

  const toggle = (skill: Skill) => {
    if (isSelected(skill.id)) {
      onChange(selected.filter((selectedSkill) => selectedSkill.id !== skill.id));
    } else {
      onChange([...selected, skill]);
    }
  };

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border',
          selected.length > 0
            ? 'bg-monokai-purple/10 border-monokai-purple text-monokai-purple shadow-[0_0_10px_rgba(174,129,255,0.2)]'
            : 'bg-gruv-dark-3 border-gruv-dark-4 text-gruv-light-4 hover:border-gruv-light-4',
        )}
      >
        <BookOpen className="w-3.5 h-3.5" />
        SKILLS
        {selected.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-monokai-purple text-white text-[10px] leading-none font-bold">
            {selected.length}
          </span>
        )}
        <ChevronDown className={clsx('w-2.5 h-2.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-gruv-dark-1 border border-gruv-dark-4/60 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="p-3 border-b border-gruv-dark-4/30 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gruv-dark-4 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter skills…"
              className="flex-grow bg-transparent text-xs text-gruv-light-1 placeholder:text-gruv-dark-4 outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {allSkills.length === 0 ? (
              <p className="text-center text-gruv-light-4 text-xs py-6">No skills yet — create them in the Skills page.</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gruv-light-4 text-xs py-6">No skills match.</p>
            ) : (
              filtered.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggle(skill)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    isSelected(skill.id)
                      ? 'bg-monokai-purple/10 text-monokai-purple'
                      : 'text-gruv-light-3 hover:bg-gruv-dark-3 hover:text-gruv-light-1',
                  )}
                >
                  <div
                    className={clsx(
                      'w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors',
                      isSelected(skill.id) ? 'bg-monokai-purple border-monokai-purple' : 'border-gruv-dark-4',
                    )}
                  >
                    {isSelected(skill.id) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{skill.name}</p>
                    {skill.tags && <p className="text-[10px] text-gruv-dark-4 truncate">{skill.tags}</p>}
                  </div>
                </button>
              ))
            )}
          </div>

          {selected.length > 0 && (
            <div className="px-4 py-2 border-t border-gruv-dark-4/30 flex justify-between items-center">
              <span className="text-[10px] text-gruv-light-4">{selected.length} selected</span>
              <button type="button" onClick={() => onChange([])} className="text-[10px] text-monokai-red hover:underline">
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
