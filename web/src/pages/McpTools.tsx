import React, { useEffect, useMemo, useState } from 'react';
import { deleteArtifact, executeMcpTool, fetchArtifactBlob, fetchArtifactText, fetchMcpProviderDoc, getMcpProviders, getMcpTools, type McpTool } from '../api/llm';
import { Wrench, Box, Code, Play, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChartComponent } from '../components/ChartComponent';
import { CapabilityBadge, ProviderSummaryBadges, ToolCapabilityBadges } from '../components/capabilities/CapabilityBadges';
import { MarkdownContent } from '../components/MarkdownContent';
import { useAppDialog } from '../components/ui/AppDialogProvider';
import { toast } from 'sonner';
import { Link } from 'react-router';
import type { McpProviderStatus } from '../types';

const McpTools: React.FC = () => {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [providers, setProviders] = useState<McpProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [guidedInput, setGuidedInput] = useState<Record<string, string>>({});
  const [inputJSON, setInputJSON] = useState('{\n  "query": "SELECT 1 AS ok"\n}');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [selectedPlannedTool, setSelectedPlannedTool] = useState<string>('');
  const [plannedToolDoc, setPlannedToolDoc] = useState('');
  const [plannedToolDocLoading, setPlannedToolDocLoading] = useState(false);
  const [plannedToolDocError, setPlannedToolDocError] = useState('');
  const [artifactState, setArtifactState] = useState<QuantLabArtifactState>({
    reportMarkdown: '',
    reportJson: null,
    trades: [],
    images: {},
    loading: false,
    deleting: false,
    error: '',
  });
  const dialog = useAppDialog();

  useEffect(() => {
    Promise.all([getMcpTools(), getMcpProviders()])
      .then(([toolData, providerData]) => {
        setTools(toolData);
        setProviders(providerData);
        if (toolData[0]?.name) {
          setSelectedTool(toolData[0].name);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const activeTool = useMemo(
    () => tools.find((tool) => tool.name === selectedTool) || null,
    [selectedTool, tools],
  );
  const providerById = useMemo(
    () =>
      new Map(
        providers.map((provider) => [provider.id || provider.name, provider]),
      ),
    [providers],
  );

  const schemaProperties = useMemo(() => {
    const properties = activeTool?.input_schema?.properties;
    return properties && typeof properties === 'object' ? Object.entries(properties) : [];
  }, [activeTool]);

  const schemaExamples = useMemo(() => buildExamples(activeTool), [activeTool]);
  const quantLabResult = useMemo(() => getQuantLabResult(selectedTool, result), [selectedTool, result]);
  const quantLabCharts = useMemo(() => buildQuantLabCharts(quantLabResult), [quantLabResult]);
  const plannedTools = useMemo(
    () => providers.flatMap((provider) => (provider.planned_tools ?? []).map((tool) => ({ provider: provider.name, tool }))),
    [providers],
  );
  const installedProviderSummaries = useMemo(
    () => providers.filter((provider) => provider.status === 'installed' || provider.enabled),
    [providers],
  );
  const activePlannedTool = useMemo(
    () => plannedTools.find((entry) => entry.tool === selectedPlannedTool) || plannedTools[0] || null,
    [plannedTools, selectedPlannedTool],
  );

  useEffect(() => {
    let cancelled = false;

    const loadProviderDoc = async () => {
      if (!activePlannedTool?.provider) {
        setPlannedToolDoc('');
        setPlannedToolDocError('');
        setPlannedToolDocLoading(false);
        return;
      }

      setPlannedToolDocLoading(true);
      setPlannedToolDocError('');
      try {
        const content = await fetchMcpProviderDoc(activePlannedTool.provider);
        if (!cancelled) {
          setPlannedToolDoc(content);
          setPlannedToolDocLoading(false);
        }
      } catch (docError: any) {
        if (!cancelled) {
          setPlannedToolDoc('');
          setPlannedToolDocLoading(false);
          setPlannedToolDocError(docError?.message || 'Failed to load provider guide');
        }
      }
    };

    void loadProviderDoc();

    return () => {
      cancelled = true;
    };
  }, [activePlannedTool]);

  useEffect(() => {
    let cancelled = false;
    const imageUrls: string[] = [];

    const loadArtifacts = async () => {
      if (!quantLabResult) {
        setArtifactState({
          reportMarkdown: '',
          reportJson: null,
          trades: [],
          images: {},
          loading: false,
          deleting: false,
          error: '',
        });
        return;
      }

      setArtifactState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const nextState: QuantLabArtifactState = {
          reportMarkdown: '',
          reportJson: null,
          trades: [],
          images: {},
          loading: false,
          deleting: false,
          error: '',
        };

        for (const artifact of quantLabResult.artifacts) {
          const lowerName = artifact.name.toLowerCase();
          if (lowerName.endsWith('.md')) {
            nextState.reportMarkdown = await fetchArtifactText(artifact.path);
          } else if (lowerName === 'report.json') {
            const raw = await fetchArtifactText(artifact.path);
            nextState.reportJson = JSON.parse(raw);
          } else if (lowerName.endsWith('.csv') && lowerName === 'trades.csv') {
            const raw = await fetchArtifactText(artifact.path);
            nextState.trades = parseCsv(raw);
          } else if (lowerName.endsWith('.png')) {
            const blob = await fetchArtifactBlob(artifact.path);
            const url = URL.createObjectURL(blob);
            imageUrls.push(url);
            nextState.images[artifact.name] = url;
          }
        }

        if (!cancelled) {
          setArtifactState(nextState);
        }
      } catch (artifactError: any) {
        if (!cancelled) {
          setArtifactState((prev) => ({
            ...prev,
            loading: false,
            error: artifactError?.message || 'Failed to load QuantLab artifacts',
          }));
        }
      }
    };

    void loadArtifacts();

    return () => {
      cancelled = true;
      imageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [quantLabResult]);

  const handleDeleteArtifacts = async () => {
    if (!quantLabResult || quantLabResult.artifacts.length === 0) return;
    const confirmed = await dialog.confirm({
      title: 'Delete QuantLab artifacts',
      description: 'This removes the generated charts, reports, and trade files for the current run.',
      confirmLabel: 'Delete Artifacts',
      tone: 'danger',
    });
    if (!confirmed) return;

    const targetPath = quantLabResult.artifacts[0]?.path || '';
    if (!targetPath) return;

    setArtifactState((prev) => ({ ...prev, deleting: true, error: '' }));
    try {
      await deleteArtifact(targetPath);
      setArtifactState({
        reportMarkdown: '',
        reportJson: null,
        trades: [],
        images: {},
        loading: false,
        deleting: false,
        error: '',
      });
      toast.success('QuantLab artifacts deleted.');
    } catch (deleteError: any) {
      setArtifactState((prev) => ({
        ...prev,
        deleting: false,
        error: deleteError?.message || 'Failed to delete artifacts',
      }));
      await dialog.alert({
        title: 'Artifact cleanup failed',
        description: deleteError?.message || 'The QuantLab artifacts could not be deleted.',
        tone: 'danger',
      });
    }
  };

  useEffect(() => {
    if (!activeTool) return;
    const nextGuidedInput = buildGuidedDefaults(activeTool);
    setGuidedInput(nextGuidedInput);
    setInputJSON(JSON.stringify(buildJSONFromGuided(nextGuidedInput, activeTool), null, 2));
    setResult(null);
    setError('');
  }, [activeTool]);

  useEffect(() => {
    if (!activeTool || advancedMode) return;
    setInputJSON(JSON.stringify(buildJSONFromGuided(guidedInput, activeTool), null, 2));
  }, [guidedInput, activeTool, advancedMode]);

  const handleRun = async () => {
    if (!selectedTool) return;
    setError('');
    setResult(null);

    let parsedInput: any;
    try {
      parsedInput = JSON.parse(inputJSON);
    } catch {
      setError('Input must be valid JSON.');
      return;
    }

    setRunning(true);
    try {
      const response = await executeMcpTool(selectedTool, parsedInput);
      setResult(response);
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to execute MCP tool';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setRunning(false);
    }
  };

  const applyExample = (example: Record<string, any>) => {
    if (!activeTool) return;
    const nextGuidedInput = Object.fromEntries(
      Object.entries(example).map(([key, value]) => [key, formatFieldValue(value)])
    );
    setGuidedInput((prev) => ({ ...prev, ...nextGuidedInput }));
    setInputJSON(JSON.stringify(example, null, 2));
    setAdvancedMode(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-monokai-pink"></div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto min-h-screen space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Wrench className="w-8 h-8 text-monokai-pink" />
          <div>
            <h1 className="text-3xl font-bold text-gruv-light-0">MCP Tool Playground</h1>
            <p className="text-sm text-gruv-light-4">Inspect schemas, craft inputs, and execute tools through a temporary pipeline. Provider state and runtime diagnostics live in System.</p>
          </div>
        </div>
        <Link
          to="/system"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xs bg-monokai-aqua/10 border border-monokai-aqua/20 text-monokai-aqua hover:bg-monokai-aqua/15 transition-colors text-xs font-semibold"
        >
          Open System View
        </Link>
      </div>

      <div className="space-y-4">
        {installedProviderSummaries.length > 0 && (
          <section className="glass border border-white/10 rounded-xs p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-semibold text-gruv-light-1">Installed Capability Providers</h2>
                <p className="text-xs text-gruv-light-4 mt-1">This is the visible provider inventory exposed by the core. It shows scope, type, and current tool surface without having to infer capabilities from prompts.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {installedProviderSummaries.map((provider) => (
                <div key={provider.id || provider.name} className="rounded-xs border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gruv-light-1">{provider.id || provider.name}</p>
                      <p className="mt-1 text-xs text-gruv-light-4">{provider.reason || provider.status}</p>
                    </div>
                    <CapabilityBadge
                      label={provider.enabled ? 'enabled' : 'disabled'}
                      tone={provider.enabled ? 'success' : 'warning'}
                    />
                  </div>
                  <ProviderSummaryBadges
                    scope={provider.scope}
                    providerType={provider.provider_type}
                    toolCount={provider.tool_count ?? provider.installed_tools.length}
                  />
                  {provider.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {provider.capabilities.slice(0, 4).map((capability) => (
                        <CapabilityBadge key={capability} label={capability} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {plannedTools.length > 0 && (
          <section className="glass border border-white/10 rounded-xs p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-semibold text-gruv-light-1">Planned Tool Surface</h2>
                <p className="text-xs text-gruv-light-4 mt-1">These MCP tools are declared by the core as planned provider surface, but are not executable yet in the playground.</p>
              </div>
              <Link
                to="/system"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xs bg-white/5 border border-white/10 text-gruv-light-2 hover:bg-white/10 transition-colors text-xs font-semibold"
              >
                Review Providers
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {plannedTools.map(({ provider, tool }) => (
                <button
                  type="button"
                  key={`${provider}-${tool}`}
                  onClick={() => setSelectedPlannedTool(tool)}
                  className={`px-2 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    activePlannedTool?.tool === tool
                      ? 'border-monokai-purple/40 bg-monokai-purple/20 text-monokai-purple'
                      : 'border-monokai-purple/20 bg-monokai-purple/10 text-monokai-purple'
                  }`}
                >
                  {provider} • {tool}
                </button>
              ))}
            </div>
            {activePlannedTool && (
              <div className="mt-4 rounded-xs border border-monokai-purple/20 bg-monokai-purple/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Planned Tool Details</p>
                <h3 className="mt-2 text-base font-semibold text-gruv-light-1">{activePlannedTool.tool}</h3>
                <p className="mt-1 text-xs text-gruv-light-4">Provider: {activePlannedTool.provider}</p>
                <p className="mt-3 text-sm text-gruv-light-3">
                  This tool is declared by the core as part of the provider surface, but it is not executable yet in the playground. Use System to inspect provider state, and treat this as a roadmap signal rather than a runtime error.
                </p>
                <div className="mt-4 rounded-xs border border-white/10 bg-black/10 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Provider Guide</p>
                  {plannedToolDocLoading ? (
                    <div className="mt-3 flex justify-center">
                      <RefreshCw className="w-4 h-4 animate-spin text-monokai-aqua" />
                    </div>
                  ) : plannedToolDoc ? (
                    <div className="mt-3 max-h-[360px] overflow-y-auto pr-2">
                      <MarkdownContent content={plannedToolDoc} />
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-gruv-light-4">
                      {plannedToolDocError || 'No provider guide available.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <motion.button
              type="button"
              key={tool.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedTool(tool.name)}
              className={`glass p-5 rounded-xs text-left border transition-colors ${selectedTool === tool.name ? 'border-monokai-pink bg-monokai-pink/5' : 'border-white/10 hover:border-monokai-pink/30'}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-gruv-dark-3">
                  <Box className="w-5 h-5 text-monokai-aqua" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gruv-light-1">{tool.name}</h3>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-gruv-light-4 mt-1">
                    {(providerById.get(tool.provider_id || '')?.id || tool.provider_id || 'unknown provider').toString()}
                  </p>
                </div>
              </div>
              <p className="text-gruv-light-4 text-sm italic">{tool.description}</p>
              <div className="mt-3 space-y-2">
                <ToolCapabilityBadges
                  readOnly={tool.read_only}
                  openWorld={tool.open_world}
                  destructive={tool.destructive}
                  tags={tool.tags}
                />
                {tool.provider_id && providerById.get(tool.provider_id) && (
                  <ProviderSummaryBadges
                    scope={providerById.get(tool.provider_id)?.scope}
                    providerType={providerById.get(tool.provider_id)?.provider_type}
                    toolCount={providerById.get(tool.provider_id)?.tool_count}
                  />
                )}
              </div>
            </motion.button>
          ))}
        </div>

        {tools.length === 0 && (
          <div className="text-center py-20 bg-gruv-dark-2 rounded-2xl border border-dashed border-gruv-dark-4">
            <p className="text-gruv-light-4">No MCP tools registered in stepbit-core.</p>
          </div>
        )}

        <div className="glass p-5 rounded-xs border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gruv-light-1">{activeTool?.name || 'Tool Playground'}</h2>
              <p className="text-xs text-gruv-light-4">Execution-only surface. Start with guided fields when the schema is simple; switch to raw JSON when needed.</p>
              {activeTool && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="text-[11px] text-gruv-light-4">
                    Provider: <span className="text-gruv-light-2">{providerById.get(activeTool.provider_id || '')?.id || activeTool.provider_id || 'unknown'}</span>
                  </div>
                  <ToolCapabilityBadges
                    readOnly={activeTool.read_only}
                    openWorld={activeTool.open_world}
                    destructive={activeTool.destructive}
                    tags={activeTool.tags}
                  />
                </div>
              )}
            </div>
            <button
              onClick={handleRun}
              disabled={!selectedTool || running}
              className="flex items-center gap-2 bg-monokai-pink text-white px-4 py-2.5 rounded-xs text-sm font-medium border border-monokai-pink/70 disabled:opacity-60"
            >
              {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? 'Running...' : 'Run Tool'}
            </button>
          </div>

          {schemaExamples.length > 0 && (
            <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-monokai-orange" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Quick Examples</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {schemaExamples.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyExample(example)}
                    className="px-3 py-2 rounded-xs bg-white/5 border border-white/10 text-sm text-gruv-light-2 hover:bg-white/10"
                  >
                    {summarizeExample(example)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xs border border-white/10 bg-gruv-dark-0/70">
            <div className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-gruv-light-3 border-b border-white/10">
              <Code className="w-4 h-4" />
              Input Schema
            </div>
            <pre className="p-3 text-[11px] text-monokai-green overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(activeTool?.input_schema || {}, null, 2)}
            </pre>
          </div>

          <label className="flex items-center justify-between gap-4 p-3 rounded-xs bg-black/20 border border-white/5">
            <div>
              <div className="text-xs font-semibold text-gruv-light-1">Advanced JSON Mode</div>
              <div className="text-[11px] text-gruv-light-4">Use guided fields when the schema is simple. Switch to JSON for nested or custom payloads.</div>
            </div>
            <button
              type="button"
              onClick={() => setAdvancedMode((prev) => !prev)}
              className={`relative w-12 h-7 rounded-xs transition-colors ${advancedMode ? 'bg-monokai-pink' : 'bg-gruv-dark-4'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-xs bg-white transition-transform ${advancedMode ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          {!advancedMode && schemaProperties.length > 0 ? (
            <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-4 space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Guided Input</p>
              {schemaProperties.map(([key, schema]: [string, any]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">
                    {key}
                    {schema?.type ? <span className="ml-2 text-[11px] text-gruv-light-4">({schema.type})</span> : null}
                  </label>
                  {schema?.description && <p className="text-[11px] text-gruv-light-4 mb-1.5">{schema.description}</p>}
                  <textarea
                    value={guidedInput[key] ?? ''}
                    onChange={(e) => setGuidedInput((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={schema?.type === 'string' ? 3 : 4}
                    className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-gruv-light-1 font-mono"
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gruv-light-3 mb-1.5">Input JSON</label>
            <textarea
              value={inputJSON}
              onChange={(e) => setInputJSON(e.target.value)}
              rows={12}
              className="w-full rounded-xs bg-gruv-dark-0 border border-white/10 px-3 py-2.5 text-sm text-monokai-green font-mono"
            />
          </div>

          {error && (
            <div className="rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 px-3 py-2.5 text-sm text-monokai-pink">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ToolStat label="Trace Steps" value={String(result?.runtime?.trace_steps || 0)} />
            <ToolStat label="Tool Calls" value={String(result?.runtime?.tool_call_count || 0)} />
            <ToolStat label="Intermediate Results" value={String(result?.runtime?.intermediate_result_count || 0)} />
          </div>

          {result?.stage_summaries?.length > 0 && (
            <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Execution Stages</p>
              {result.stage_summaries.map((stage: any) => (
                <div key={`${stage.index}-${stage.title}`} className="rounded-xs border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gruv-light-1">{stage.title}</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-monokai-green/15 text-monokai-green border border-monokai-green/20">
                      {stage.status}
                    </span>
                  </div>
                  {stage.trace_excerpt && <p className="mt-2 text-xs text-gruv-light-3 whitespace-pre-wrap">{stage.trace_excerpt}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xs border border-white/10 bg-gruv-dark-0/70">
            <div className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-gruv-light-3 border-b border-white/10">
              <Code className="w-4 h-4" />
              Result
            </div>
            {quantLabResult && (
              <QuantLabResultPanel
                result={quantLabResult}
                artifactState={artifactState}
                charts={quantLabCharts}
                onDeleteArtifacts={handleDeleteArtifacts}
              />
            )}
            <pre className="p-3 text-[11px] text-gruv-light-2 overflow-x-auto whitespace-pre-wrap min-h-[220px]">
              {JSON.stringify(result || { hint: 'Run a tool to inspect intermediate results, trace, and normalized runtime metadata.' }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const ToolStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-4 py-3">
    <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
    <p className="mt-1.5 text-base font-semibold text-gruv-light-1">{value}</p>
  </div>
);

const QuantLabResultPanel = ({
  result,
  artifactState,
  charts,
  onDeleteArtifacts,
}: {
  result: QuantLabResult;
  artifactState: QuantLabArtifactState;
  charts: Array<{ title: string; chartData: any }>;
  onDeleteArtifacts: () => void;
}) => {
  const metricEntries = [
    ['Status', result.status || 'unknown'],
    ['Run ID', result.run_id || 'n/a'],
    ['Total Return', formatMetric(result.metrics?.total_return, 'percent')],
    ['Sharpe', formatMetric(result.metrics?.sharpe_simple, 'number')],
    ['Max Drawdown', formatMetric(result.metrics?.max_drawdown, 'percent')],
    ['Trades', formatMetric(result.metrics?.trades, 'integer')],
    ['Win Rate', formatMetric(result.metrics?.win_rate, 'percent')],
  ];

  return (
    <div className="border-b border-white/10 bg-black/10 p-3 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {metricEntries.map(([label, value]) => (
          <div key={label} className="rounded-xs border border-white/10 bg-gruv-dark-0/70 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
            <p className="mt-1 text-sm font-semibold text-gruv-light-1 break-words">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDeleteArtifacts}
          disabled={artifactState.deleting || result.artifacts.length === 0}
          className="inline-flex items-center gap-2 rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 px-3 py-2 text-xs font-semibold text-monokai-pink disabled:opacity-50"
        >
          {artifactState.deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {artifactState.deleting ? 'Deleting artifacts...' : 'Delete Artifacts'}
        </button>
      </div>

      {charts.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {charts.map((chart) => (
            <ChartComponent key={chart.title} chartData={chart.chartData} />
          ))}
        </div>
      )}

      {(artifactState.loading || artifactState.error) && (
        <div className={`rounded-xs border p-3 ${artifactState.error ? 'border-monokai-pink/30 bg-monokai-pink/10 text-monokai-pink' : 'border-white/10 bg-gruv-dark-0/60 text-gruv-light-3'}`}>
          {artifactState.error || 'Loading artifacts...'}
        </div>
      )}

      {Object.keys(artifactState.images).length > 0 && (
        <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Generated Charts</p>
          <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {Object.entries(artifactState.images).map(([name, url]) => (
              <div key={name} className="rounded-xs border border-white/10 bg-black/20 p-3">
                <p className="mb-3 text-sm font-medium text-gruv-light-1">{name}</p>
                <img src={url} alt={name} className="w-full h-auto rounded-xs border border-white/10" />
              </div>
            ))}
          </div>
        </div>
      )}

      {artifactState.reportMarkdown && (
        <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Research Report</p>
          <div className="mt-3">
            <MarkdownContent content={artifactState.reportMarkdown} />
          </div>
        </div>
      )}

      {artifactState.trades.length > 0 && (
        <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Trade Log</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gruv-dark-3 text-monokai-aqua border-b border-white/10">
                <tr>
                  {Object.keys(artifactState.trades[0]).map((column) => (
                    <th key={column} className="px-3 py-2 border-r border-white/10 last:border-r-0 whitespace-nowrap">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artifactState.trades.slice(0, 20).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-white/5 hover:bg-white/5">
                    {Object.entries(row).map(([column, value]) => (
                      <td key={`${rowIndex}-${column}`} className="px-3 py-2 border-r border-white/5 last:border-r-0 whitespace-nowrap text-gruv-light-2">
                        {String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {artifactState.reportJson && (
        <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Structured Report Summary</p>
          <pre className="mt-3 text-[11px] text-gruv-light-2 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(
              artifactState.reportJson.summary || artifactState.reportJson.kpi_summary || artifactState.reportJson,
              null,
              2,
            )}
          </pre>
        </div>
      )}

      {result.artifacts.length > 0 && (
        <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Artifacts</p>
          <div className="mt-3 space-y-2">
            {result.artifacts.map((artifact) => (
              <div key={artifact.path} className="rounded-xs border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-sm font-medium text-gruv-light-1">{artifact.name}</p>
                <p className="mt-1 text-[11px] text-gruv-light-4 break-all">{artifact.path}</p>
                <p className="mt-1 text-[11px] text-gruv-light-3">{formatBytes(artifact.size_bytes)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.events.length > 0 && (
        <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4">Session Events</p>
          <div className="mt-3 space-y-2">
            {result.events.map((event, index) => (
              <div key={`${event.event}-${event.timestamp}-${index}`} className="rounded-xs border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-sm font-medium text-gruv-light-1">{String(event.event || 'unknown')}</p>
                <p className="mt-1 text-[11px] text-gruv-light-3">
                  {String(event.status || 'unknown')}
                  {event.timestamp ? ` • ${String(event.timestamp)}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-monokai-pink">Adapter Issues</p>
          <div className="mt-3 space-y-2">
            {result.errors.map((issue, index) => (
              <div key={`${issue.code}-${index}`} className="rounded-xs border border-monokai-pink/20 bg-black/10 px-3 py-2">
                <p className="text-sm font-medium text-gruv-light-1">{issue.code}</p>
                <p className="mt-1 text-[11px] text-monokai-pink whitespace-pre-wrap">{issue.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

type QuantLabResult = {
  status?: string;
  run_id?: string;
  metrics?: Record<string, any>;
  artifacts: Array<{ name: string; path: string; size_bytes: number }>;
  events: Array<Record<string, any>>;
  errors: Array<{ code: string; message: string; severity?: string }>;
};

type QuantLabArtifactState = {
  reportMarkdown: string;
  reportJson: Record<string, any> | null;
  trades: Array<Record<string, string>>;
  images: Record<string, string>;
  loading: boolean;
  deleting: boolean;
  error: string;
};

const buildGuidedDefaults = (tool: McpTool) => {
  if (tool.name === 'quantlab_run') {
    return {
      strategy: 'rsi_ma_cross_v2',
      date_range: JSON.stringify({ start: '2023-01-01', end: '2023-12-31' }, null, 2),
      features: JSON.stringify(
        {
          ticker: 'ETH-USD',
          interval: '1d',
          save_price_plot: true,
          fee: 0.002,
          initial_cash: 1000,
          slippage_bps: 8,
          slippage_mode: 'fixed',
          k_atr: 0.05,
        },
        null,
        2,
      ),
      parameters: JSON.stringify(
        {
          rsi_buy_max: 60,
          rsi_sell_min: 75,
          cooldown_days: 0,
        },
        null,
        2,
      ),
      timeout_seconds: '180',
      run_label: 'Demo ETH baseline',
    };
  }
  if (tool.name === 'quantlab_sweep') {
    return {
      strategy: 'rsi_ma_cross_v2',
      date_range: JSON.stringify({ start: '2023-01-01', end: '2023-12-31' }, null, 2),
      features: JSON.stringify({ ticker: 'ETH-USD', interval: '1d', fee: 0.002, initial_cash: 1000 }, null, 2),
      parameters: JSON.stringify({ cooldown_days: 0 }, null, 2),
      parameter_sets: JSON.stringify([
        { label: 'baseline', parameters: { rsi_buy_max: 60, rsi_sell_min: 75 } },
        { label: 'tighter', parameters: { rsi_buy_max: 58, rsi_sell_min: 74 } },
      ], null, 2),
      objective: 'total_return',
      timeout_seconds: '180',
      run_label: 'ETH sweep',
    };
  }
  if (tool.name === 'quantlab_forward') {
    return {
      strategy: 'rsi_ma_cross_v2',
      features: JSON.stringify({ ticker: 'ETH-USD', interval: '1d', fee: 0.002, initial_cash: 1000 }, null, 2),
      parameters: JSON.stringify({ rsi_buy_max: 60, rsi_sell_min: 75 }, null, 2),
      segments: JSON.stringify([
        { label: 'train-2023h1', start: '2023-01-01', end: '2023-06-30' },
        { label: 'eval-2023h2', start: '2023-07-01', end: '2023-12-31' },
      ], null, 2),
      timeout_seconds: '180',
      run_label: 'ETH forward',
    };
  }
  if (tool.name === 'quantlab_portfolio') {
    return {
      strategy: 'rsi_ma_cross_v2',
      date_range: JSON.stringify({ start: '2023-01-01', end: '2023-12-31' }, null, 2),
      features: JSON.stringify({ interval: '1d', fee: 0.002, initial_cash: 1000 }, null, 2),
      parameters: JSON.stringify({ rsi_buy_max: 60, rsi_sell_min: 75 }, null, 2),
      legs: JSON.stringify([
        { label: 'btc', ticker: 'BTC-USD', weight: 0.6 },
        { label: 'eth', ticker: 'ETH-USD', weight: 0.4 },
      ], null, 2),
      timeout_seconds: '180',
      run_label: 'Crypto basket',
    };
  }

  const properties = tool.input_schema?.properties || {};
  const defaults: Record<string, string> = {};
  Object.entries(properties).forEach(([key, schema]: [string, any]) => {
    if (tool.name === 'duckdb_query' && key === 'query') {
      defaults[key] = 'SELECT 1 AS ok';
      return;
    }
    if (schema?.default !== undefined) {
      defaults[key] = formatFieldValue(schema.default);
      return;
    }
    if (schema?.examples?.[0] !== undefined) {
      defaults[key] = formatFieldValue(schema.examples[0]);
      return;
    }
    defaults[key] = schema?.type === 'string' ? '' : '{}';
  });
  return defaults;
};

const buildJSONFromGuided = (guidedInput: Record<string, string>, tool: McpTool) => {
  const properties = tool.input_schema?.properties || {};
  const result: Record<string, any> = {};

  Object.entries(properties).forEach(([key, schema]: [string, any]) => {
    const raw = guidedInput[key];
    if (raw === undefined || raw.trim() === '') return;
    result[key] = parseGuidedValue(raw, schema?.type);
  });

  return result;
};

const parseGuidedValue = (raw: string, type?: string) => {
  if (type === 'number' || type === 'integer') {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? raw : parsed;
  }
  if (type === 'boolean') {
    return raw.trim().toLowerCase() === 'true';
  }
  if (type === 'object' || type === 'array') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
};

const formatFieldValue = (value: any) => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
};

const buildExamples = (tool: McpTool | null) => {
  if (!tool) return [];
  if (tool.name === 'duckdb_query') {
    return [
      { query: 'SELECT 1 AS ok' },
      { query: 'SELECT id, title FROM sessions ORDER BY updated_at DESC LIMIT 5' },
      { query: "SELECT source_type, status, created_at FROM execution_runs ORDER BY created_at DESC LIMIT 10" },
    ];
  }
  if (tool.name === 'quantlab_run') {
    return [
      {
        strategy: 'rsi_ma_cross_v2',
        date_range: { start: '2023-01-01', end: '2023-12-31' },
        features: {
          ticker: 'ETH-USD',
          interval: '1d',
          save_price_plot: true,
          fee: 0.002,
          initial_cash: 1000,
          slippage_bps: 8,
          slippage_mode: 'fixed',
          k_atr: 0.05,
        },
        parameters: {
          rsi_buy_max: 60,
          rsi_sell_min: 75,
          cooldown_days: 0,
        },
        timeout_seconds: 180,
        run_label: 'Demo ETH baseline',
      },
      {
        strategy: 'rsi_ma_cross_v2',
        date_range: { start: '2024-01-01', end: '2024-12-31' },
        features: {
          ticker: 'BTC-USD',
          interval: '1d',
          save_price_plot: false,
          fee: 0.002,
          initial_cash: 1000,
          slippage_bps: 8,
          slippage_mode: 'fixed',
        },
        parameters: {
          rsi_buy_max: 58,
          rsi_sell_min: 74,
          cooldown_days: 1,
        },
        timeout_seconds: 180,
        run_label: 'Demo BTC baseline',
      },
    ];
  }
  if (tool.name === 'quantlab_sweep') {
    return [
      {
        strategy: 'rsi_ma_cross_v2',
        date_range: { start: '2023-01-01', end: '2023-12-31' },
        features: { ticker: 'ETH-USD', interval: '1d', fee: 0.002, initial_cash: 1000 },
        parameters: { cooldown_days: 0 },
        parameter_sets: [
          { label: 'baseline', parameters: { rsi_buy_max: 60, rsi_sell_min: 75 } },
          { label: 'tighter', parameters: { rsi_buy_max: 58, rsi_sell_min: 74 } },
        ],
        objective: 'total_return',
        timeout_seconds: 180,
        run_label: 'ETH sweep',
      },
    ];
  }
  if (tool.name === 'quantlab_forward') {
    return [
      {
        strategy: 'rsi_ma_cross_v2',
        features: { ticker: 'ETH-USD', interval: '1d', fee: 0.002, initial_cash: 1000 },
        parameters: { rsi_buy_max: 60, rsi_sell_min: 75 },
        segments: [
          { label: 'train-2023h1', start: '2023-01-01', end: '2023-06-30' },
          { label: 'eval-2023h2', start: '2023-07-01', end: '2023-12-31' },
        ],
        timeout_seconds: 180,
        run_label: 'ETH forward',
      },
    ];
  }
  if (tool.name === 'quantlab_portfolio') {
    return [
      {
        strategy: 'rsi_ma_cross_v2',
        date_range: { start: '2023-01-01', end: '2023-12-31' },
        features: { interval: '1d', fee: 0.002, initial_cash: 1000 },
        parameters: { rsi_buy_max: 60, rsi_sell_min: 75 },
        legs: [
          { label: 'btc', ticker: 'BTC-USD', weight: 0.6 },
          { label: 'eth', ticker: 'ETH-USD', weight: 0.4 },
        ],
        timeout_seconds: 180,
        run_label: 'Crypto basket',
      },
    ];
  }

  const properties = tool.input_schema?.properties || {};
  const generated = Object.fromEntries(
    Object.entries(properties).map(([key, schema]: [string, any]) => [
      key,
      schema?.examples?.[0] ?? schema?.default ?? (schema?.type === 'string' ? '' : schema?.type === 'number' ? 0 : {}),
    ])
  );
  return Object.keys(generated).length > 0 ? [generated] : [];
};

const summarizeExample = (example: Record<string, any>) => {
  const entries = Object.entries(example);
  if (entries.length === 0) return 'empty example';
  const [firstKey, firstValue] = entries[0];
  const preview = typeof firstValue === 'string' ? firstValue : JSON.stringify(firstValue);
  return `${firstKey}: ${preview.slice(0, 36)}`;
};

const getQuantLabResult = (toolName: string, result: any): QuantLabResult | null => {
  if (toolName !== 'quantlab_run' || !result || typeof result !== 'object') {
    return null;
  }

  const toolResult = extractQuantLabToolResult(result);
  if (!toolResult || typeof toolResult !== 'object') {
    return null;
  }

  return {
    status: toolResult.status,
    run_id: toolResult.run_id,
    metrics: toolResult.metrics ?? {},
    artifacts: Array.isArray(toolResult.artifacts) ? toolResult.artifacts : [],
    events: Array.isArray(toolResult.events) ? toolResult.events : [],
    errors: Array.isArray(toolResult.errors) ? toolResult.errors : [],
  };
};

const extractQuantLabToolResult = (result: any): any => {
  if (typeof result.final_answer === 'string') {
    const trimmed = result.final_answer.trim();
    if (trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // fall through
      }
    }
  }
  if (result.tool_result && typeof result.tool_result === 'object') {
    return result.tool_result;
  }
  if (Array.isArray(result.intermediate_results)) {
    for (const entry of result.intermediate_results) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.tool_result && typeof entry.tool_result === 'object') {
        return entry.tool_result;
      }
      if (entry.result && typeof entry.result === 'object') {
        return entry.result;
      }
    }
  }
  if (result.final_answer && typeof result.final_answer === 'object') {
    return result.final_answer;
  }
  if ('status' in result && 'metrics' in result) {
    return result;
  }
  return null;
};

const formatMetric = (value: any, kind: 'percent' | 'number' | 'integer') => {
  if (value === null || value === undefined || value === '') return 'n/a';
  if (typeof value !== 'number') return String(value);
  if (kind === 'percent') return `${(value * 100).toFixed(2)}%`;
  if (kind === 'integer') return String(Math.round(value));
  return value.toFixed(3);
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value < 1024) return `${value || 0} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const buildQuantLabCharts = (result: QuantLabResult | null) => {
  if (!result?.metrics) return [];

  const metricsChart = {
    title: 'Performance Snapshot',
    chartData: {
      role: 'chart',
      type: 'bar',
      title: 'Performance Snapshot',
      data: [
        { name: 'Return %', value: Number(((result.metrics.total_return ?? 0) * 100).toFixed(2)) },
        { name: 'Drawdown %', value: Number(((result.metrics.max_drawdown ?? 0) * 100).toFixed(2)) },
        { name: 'Sharpe', value: Number((result.metrics.sharpe_simple ?? 0).toFixed(3)) },
      ],
      xAxis: 'name',
      yAxis: 'value',
    },
  };

  const trades = Number(result.metrics.trades ?? 0);
  const winRate = Number(result.metrics.win_rate ?? 0);
  const wins = Math.max(0, Math.round(trades * winRate));
  const losses = Math.max(0, trades - wins);
  const tradeMixChart = {
    title: 'Trade Mix',
    chartData: {
      role: 'chart',
      type: 'pie',
      title: 'Trade Mix',
      data: [
        { name: 'Wins', value: wins },
        { name: 'Losses', value: losses },
      ],
      xAxis: 'name',
      yAxis: 'value',
    },
  };

  return [metricsChart, tradeMixChart];
};

const parseCsv = (raw: string): Array<Record<string, string>> => {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });
};

const splitCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
};

export default McpTools;
