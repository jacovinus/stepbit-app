import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillsApi, type Skill, type CreateSkillRequest, type UpdateSkillRequest } from '../api/skills';
import {
    BookOpen, Plus, Clipboard, Pencil, Trash2, X, Check,
    Link, Loader2, Tag, Search, ChevronDown
} from 'lucide-react';

function parseTags(tags: string): string[] {
    return tags.split(',').map(t => t.trim()).filter(Boolean);
}

// ─── Tag Badge ───────────────────────────────────────────────────────────────

const TagBadge = ({ label }: { label: string }) => (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xs text-xs font-medium uppercase tracking-wide bg-monokai-purple/20 text-monokai-purple border border-monokai-purple/30">
        <Tag className="w-2.5 h-2.5" /> {label}
    </span>
);

// ─── Skill Card ──────────────────────────────────────────────────────────────

interface SkillCardProps {
    skill: Skill;
    onEdit: (skill: Skill) => void;
    onView: (skill: Skill) => void;
    onDelete: (id: number) => void;
}

const SkillCard = ({ skill, onEdit, onView, onDelete }: SkillCardProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(skill.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const preview = skill.content.slice(0, 180);
    const isLong = skill.content.length > 180;
    const tags = parseTags(skill.tags);

    return (
        <div className="group relative flex h-[300px] flex-col gap-3 p-4 rounded-xs bg-gruv-dark-2/60 border border-gruv-dark-4/30 hover:border-monokai-pink/40 transition-colors duration-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xs bg-monokai-purple/15 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-monokai-purple" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-semibold text-gruv-light-1 truncate">{skill.name}</h3>
                        {skill.source_url && (
                            <a href={skill.source_url} target="_blank" rel="noreferrer"
                               className="text-[10px] text-monokai-aqua hover:underline truncate block">
                                {skill.source_url}
                            </a>
                        )}
                    </div>
                </div>
                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={handleCopy}
                        className="p-1.5 rounded-xs hover:bg-monokai-green/20 text-gruv-light-4 hover:text-monokai-green transition-colors"
                        title="Copy to clipboard">
                        {copied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                    </button>
                    <button onClick={() => onEdit(skill)}
                        className="p-1.5 rounded-xs hover:bg-gruv-yellow/20 text-gruv-light-4 hover:text-gruv-yellow transition-colors"
                        title="Edit skill">
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(skill.id)}
                        className="p-1.5 rounded-xs hover:bg-monokai-pink/20 text-gruv-light-4 hover:text-monokai-pink transition-colors"
                        title="Delete skill">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {tags.map(t => <TagBadge key={t} label={t} />)}
                </div>
            )}

            {/* Content preview */}
            <pre className="flex-1 min-h-0 overflow-hidden text-sm text-gruv-light-4 font-mono whitespace-pre-wrap leading-relaxed rounded-xs bg-gruv-dark-0/50 p-3 border border-gruv-dark-4/20">
                {preview}{isLong && '...'}
            </pre>

            {isLong && (
                <button onClick={() => onView(skill)}
                    className="flex items-center gap-1 text-[11px] text-monokai-aqua hover:text-monokai-aqua/80 transition-colors self-start">
                    <ChevronDown className="w-3 h-3" />Show more
                </button>
            )}
        </div>
    );
};

const SkillViewer = ({ skill, onClose }: { skill: Skill; onClose: () => void }) => {
    const tags = parseTags(skill.tags);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-gruv-dark-1 border border-gruv-dark-4/40 rounded-xs shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gruv-dark-4/30">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xs bg-monokai-purple/15 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-monokai-purple" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gruv-light-1 truncate">{skill.name}</h2>
                            {skill.source_url && (
                                <a href={skill.source_url} target="_blank" rel="noreferrer" className="text-xs text-monokai-aqua hover:underline truncate block">
                                    {skill.source_url}
                                </a>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xs hover:bg-gruv-dark-3 text-gruv-light-4 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex flex-col gap-4">
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(t => <TagBadge key={t} label={t} />)}
                        </div>
                    )}
                    <pre className="w-full bg-gruv-dark-0 border border-gruv-dark-4/30 rounded-xs px-4 py-4 text-gruv-light-1 font-mono text-sm whitespace-pre-wrap leading-relaxed overflow-x-auto">
                        {skill.content}
                    </pre>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gruv-dark-4/30">
                    <button type="button" onClick={onClose}
                        className="px-5 py-2.5 rounded-xs text-gruv-light-4 hover:text-white hover:bg-gruv-dark-3 transition-colors font-medium text-sm">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Skill Form Panel ────────────────────────────────────────────────────────

interface SkillFormProps {
    initial?: Skill | null;
    onClose: () => void;
    onSaved: () => void;
}

const SkillForm = ({ initial, onClose, onSaved }: SkillFormProps) => {
    const qc = useQueryClient();
    const isEdit = !!initial;

    const [name, setName] = useState(initial?.name ?? '');
    const [content, setContent] = useState(initial?.content ?? '');
    const [tags, setTags] = useState(initial?.tags ?? '');
    const [importUrl, setImportUrl] = useState('');
    const [showImport, setShowImport] = useState(false);

    const createMut = useMutation({
        mutationFn: (d: CreateSkillRequest) => skillsApi.create(d),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); onSaved(); },
    });

    const updateMut = useMutation({
        mutationFn: (d: UpdateSkillRequest) => skillsApi.update(initial!.id, d),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); onSaved(); },
    });

    const fetchMut = useMutation({
        mutationFn: () => skillsApi.fetchUrl({ url: importUrl, name: name || 'Imported Skill', tags }),
        onSuccess: (skill) => {
            setName(skill.name);
            setContent(skill.content);
            setImportUrl('');
            setShowImport(false);
            qc.invalidateQueries({ queryKey: ['skills'] });
            onSaved();
        },
    });

    const isBusy = createMut.isPending || updateMut.isPending || fetchMut.isPending;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit) {
            updateMut.mutate({ name, content, tags });
        } else {
            createMut.mutate({ name, content, tags });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-gruv-dark-1 border border-gruv-dark-4/40 rounded-xs shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gruv-dark-4/30">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xs bg-monokai-pink flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-gruv-light-1">
                            {isEdit ? 'Edit Skill' : 'New Skill'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xs hover:bg-gruv-dark-3 text-gruv-light-4 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 overflow-y-auto flex-grow">
                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gruv-light-4">Skill Name</label>
                        <input
                            value={name} onChange={e => setName(e.target.value)} required
                            placeholder="e.g. Code Review Checklist"
                            className="w-full bg-gruv-dark-2 border border-gruv-dark-4/30 rounded-xs px-4 py-2.5 text-gruv-light-1 placeholder:text-gruv-dark-4 focus:outline-none focus:border-monokai-pink/60 transition-colors"
                        />
                    </div>

                    {/* Tags */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gruv-light-4">Tags <span className="normal-case font-normal">(comma-separated)</span></label>
                        <input
                            value={tags} onChange={e => setTags(e.target.value)}
                            placeholder="e.g. prompts, review, code"
                            className="w-full bg-gruv-dark-2 border border-gruv-dark-4/30 rounded-xs px-4 py-2.5 text-gruv-light-1 placeholder:text-gruv-dark-4 focus:outline-none focus:border-monokai-pink/60 transition-colors"
                        />
                    </div>

                    {/* Content */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gruv-light-4">Content (Markdown)</label>
                        <textarea
                            value={content} onChange={e => setContent(e.target.value)} required
                            rows={12}
                            placeholder="Paste or type your skill content here..."
                            className="w-full bg-gruv-dark-0 border border-gruv-dark-4/30 rounded-xs px-4 py-3 text-gruv-light-1 font-mono text-sm placeholder:text-gruv-dark-4 focus:outline-none focus:border-monokai-pink/60 transition-colors resize-y"
                        />
                    </div>

                    {/* Import from URL */}
                    {!isEdit && (
                        <div>
                            <button type="button" onClick={() => setShowImport(!showImport)}
                                className="flex items-center gap-2 text-sm text-monokai-aqua hover:text-monokai-aqua/80 transition-colors">
                                <Link className="w-4 h-4" />
                                {showImport ? 'Cancel URL import' : 'Import from URL'}
                            </button>
                            {showImport && (
                                <div className="mt-3 flex gap-2">
                                    <input
                                        value={importUrl} onChange={e => setImportUrl(e.target.value)}
                                        placeholder="https://raw.githubusercontent.com/..."
                                        className="flex-grow bg-gruv-dark-2 border border-gruv-dark-4/30 rounded-xs px-4 py-2.5 text-gruv-light-1 placeholder:text-gruv-dark-4 focus:outline-none focus:border-monokai-aqua/60 transition-colors text-sm"
                                    />
                                    <button type="button" disabled={!importUrl || fetchMut.isPending}
                                        onClick={() => fetchMut.mutate()}
                                        className="px-4 py-2.5 rounded-xs bg-monokai-aqua text-gruv-dark-0 hover:bg-monokai-aqua/90 disabled:opacity-50 transition-colors font-medium text-sm flex items-center gap-2 border border-monokai-aqua/70">
                                        {fetchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch & Save'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gruv-dark-4/30">
                    <button type="button" onClick={onClose}
                        className="px-5 py-2.5 rounded-xs text-gruv-light-4 hover:text-white hover:bg-gruv-dark-3 transition-colors font-medium text-sm">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit as any}
                        disabled={isBusy || !name || !content}
                        className="px-5 py-2.5 rounded-xs bg-monokai-pink text-white font-medium text-sm border border-monokai-pink/70 disabled:opacity-50 transition-colors duration-200 flex items-center gap-2">
                        {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isEdit ? 'Save Changes' : 'Create Skill'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export const Skills = () => {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState<Skill | null>(null);
    const [viewTarget, setViewTarget] = useState<Skill | null>(null);
    const [search, setSearch] = useState('');

    const { data: skills = [], isLoading } = useQuery({
        queryKey: ['skills'],
        queryFn: () => skillsApi.list(),
    });

    const deleteMut = useMutation({
        mutationFn: (id: number) => skillsApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['skills'] }),
    });

    const filtered = skills.filter(s => {
        const q = search.toLowerCase();
        return !q || s.name.toLowerCase().includes(q) || s.content.toLowerCase().includes(q) || s.tags.toLowerCase().includes(q);
    });

    const handleEdit = (skill: Skill) => {
        setEditTarget(skill);
        setShowForm(true);
    };

    const handleClose = () => {
        setShowForm(false);
        setEditTarget(null);
    };

    return (
        <div className="space-y-8 max-w-[1160px] mx-auto w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gruv-light-4 bg-clip-text text-transparent">
                        Skills
                    </h1>
                    <p className="text-gruv-light-4 mt-1 text-sm">
                        Reusable markdown snippets — system prompts, templates, context blocks.
                    </p>
                </div>
                <button
                    onClick={() => { setEditTarget(null); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xs bg-monokai-pink text-white font-medium border border-monokai-pink/70 transition-colors duration-200">
                    <Plus className="w-4 h-4" /> New Skill
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gruv-dark-4" />
                <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search skills by name, content, or tags..."
                    className="w-full bg-gruv-dark-2/60 border border-gruv-dark-4/30 rounded-xs pl-11 pr-4 py-3 text-gruv-light-1 placeholder:text-gruv-dark-4 focus:outline-none focus:border-monokai-pink/60 transition-colors"
                />
            </div>

            {/* Stats */}
            <div className="flex gap-4">
                <div className="px-4 py-2 rounded-xs bg-gruv-dark-2/40 border border-gruv-dark-4/20 text-sm">
                    <span className="text-monokai-pink font-bold">{skills.length}</span>
                    <span className="text-gruv-light-4 ml-1">total skills</span>
                </div>
                {search && (
                    <div className="px-4 py-2 rounded-xs bg-gruv-dark-2/40 border border-gruv-dark-4/20 text-sm">
                        <span className="text-monokai-aqua font-bold">{filtered.length}</span>
                        <span className="text-gruv-light-4 ml-1">matching</span>
                    </div>
                )}
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin text-monokai-pink" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-16 h-16 rounded-xs bg-gruv-dark-2/60 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-gruv-dark-4" />
                    </div>
                    <p className="text-gruv-light-4 font-medium">
                        {search ? 'No skills match your search.' : 'No skills yet. Create your first one!'}
                    </p>
                    {!search && (
                        <button onClick={() => { setEditTarget(null); setShowForm(true); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xs border border-monokai-pink/40 text-monokai-pink hover:bg-monokai-pink/10 transition-colors text-sm font-medium">
                            <Plus className="w-4 h-4" /> Create Skill
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-wrap gap-4">
                    {filtered.map(skill => (
                        <div key={skill.id} className="flex-none w-full md:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.75rem)] min-w-0">
                            <SkillCard
                                skill={skill}
                                onEdit={handleEdit}
                                onView={setViewTarget}
                                onDelete={id => deleteMut.mutate(id)}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showForm && (
                <SkillForm
                    initial={editTarget}
                    onClose={handleClose}
                    onSaved={handleClose}
                />
            )}

            {viewTarget && (
                <SkillViewer
                    skill={viewTarget}
                    onClose={() => setViewTarget(null)}
                />
            )}
        </div>
    );
};
