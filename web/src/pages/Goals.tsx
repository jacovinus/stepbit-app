import React, { useMemo, useState } from 'react';
import { AlertTriangle, Brain, CheckCircle2, Play, RefreshCw, Sparkles, Target, RotateCcw } from 'lucide-react';
import { goalsApi, type GoalExecutionResult, type GoalPlan } from '../api/goals';
import { useStepbitCore } from '../hooks/useStepbitCore';

const Goals: React.FC = () => {
  const [goal, setGoal] = useState('');
  const [rlmEnabled, setRlmEnabled] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [result, setResult] = useState<GoalExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { online, loading: statusLoading, refresh: refreshStatus } = useStepbitCore();

  const canRun = online && goal.trim().length > 0;
  const stageCount = plan?.stages.length || 0;

  const failureReason = useMemo(() => {
    if (error) return error;
    return result?.result?.error || '';
  }, [error, result]);

  const handlePlan = async () => {
    if (!goal.trim()) return;
    setPlanning(true);
    setError(null);
    setResult(null);
    try {
      const data = await goalsApi.plan(goal.trim(), rlmEnabled);
      setPlan(data.plan);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to generate goal plan';
      setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setPlanning(false);
    }
  };

  const handleExecute = async () => {
    if (!goal.trim() || !plan) return;
    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      const data = await goalsApi.executePlanned(goal.trim(), plan, rlmEnabled);
      setResult(data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to execute goal';
      setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setExecuting(false);
    }
  };

  const handleReplan = async () => {
    if (!goal.trim() || !plan) return;
    setReplanning(true);
    setError(null);

    try {
      const data = await goalsApi.replan(goal.trim(), plan, failureReason || 'Refresh the plan with the latest context.', result?.result as any, rlmEnabled);
      setPlan(data.plan);
      setResult(null);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to replan goal';
      setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setReplanning(false);
    }
  };

  const resetAll = () => {
    setGoal('');
    setRlmEnabled(false);
    setPlan(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="p-4 max-w-[1280px] mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xs bg-monokai-aqua/20 border border-monokai-aqua/30">
            <Target className="w-5 h-5 text-monokai-aqua" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gruv-light-0 tracking-tight">Goal Mode</h1>
            <p className="text-xs text-gruv-light-4 font-medium">Plan, inspect, approve, execute, and replan a high-level objective against stepbit-core.</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-xs border glass ${online ? 'border-monokai-green/30 bg-monokai-green/5' : 'border-monokai-pink/30 bg-monokai-pink/5'}`}>
          <Brain className={`w-4 h-4 ${online ? 'text-monokai-green animate-pulse' : 'text-monokai-pink'}`} />
          <span className={`text-xs font-semibold ${online ? 'text-monokai-green' : 'text-monokai-pink'}`}>
            stepbit-core: {online ? 'Connected' : 'Disconnected'}
          </span>
          <button
            onClick={refreshStatus}
            className="ml-2 p-1 hover:bg-white/10 rounded-xs transition-colors"
            disabled={statusLoading}
          >
            <RefreshCw className={`w-3 h-3 text-gruv-light-4 ${statusLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4 items-start">
        <section className="glass rounded-xs border-white/10 p-4 space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gruv-light-1">Describe the objective</h2>
            <p className="text-xs text-gruv-light-4">
              Generate an app-managed plan first, inspect the stages, then approve execution. Replanning keeps the flow stable even before dedicated planner endpoints land in the core.
            </p>
          </div>

          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={7}
            placeholder="Example: Investigate the latest execution failures, summarize recurring patterns, and propose the next debugging steps."
            className="w-full bg-black/40 border border-white/5 rounded-xs px-3 py-2.5 text-xs text-gruv-light-1 focus:ring-2 focus:ring-monokai-aqua outline-none resize-y"
          />

          <label className="flex items-center justify-between gap-4 p-3 rounded-xs bg-black/20 border border-white/5">
            <div>
              <div className="text-xs font-semibold text-gruv-light-1">Enable Recursive Language Mode</div>
              <div className="text-[11px] text-gruv-light-4">Forward the request with <code className="font-mono text-monokai-orange">rlm_enabled</code> for deeper core execution when supported.</div>
            </div>
            <button
              type="button"
              onClick={() => setRlmEnabled((prev) => !prev)}
              className={`relative w-12 h-7 rounded-xs transition-colors ${rlmEnabled ? 'bg-monokai-orange' : 'bg-gruv-dark-4'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-xs bg-white transition-transform ${rlmEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Metric label="Plan Stages" value={String(stageCount)} />
            <Metric label="Trace Steps" value={String(result?.result?.runtime?.trace_steps || 0)} />
            <Metric label="Tool Calls" value={String(result?.result?.runtime?.tool_call_count || 0)} />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handlePlan}
              disabled={planning || !canRun}
              className="flex items-center gap-2 bg-monokai-aqua text-gruv-dark-0 px-4 py-2.5 rounded-xs text-sm font-medium border border-monokai-aqua/70 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Sparkles className={`w-4 h-4 ${planning ? 'animate-spin' : ''}`} />
              {planning ? 'Generating Plan...' : 'Generate Plan'}
            </button>

            <button
              onClick={handleExecute}
              disabled={executing || !plan || !online}
              className="flex items-center gap-2 bg-monokai-green text-black px-4 py-2.5 rounded-xs text-sm font-medium border border-monokai-green/70 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Play className={`w-4 h-4 ${executing ? 'animate-spin' : ''}`} />
              {executing ? 'Executing...' : 'Approve & Execute'}
            </button>

            <button
              onClick={handleReplan}
              disabled={replanning || !plan}
              className="flex items-center gap-2 bg-white/5 text-gruv-light-2 px-4 py-2.5 rounded-xs text-sm font-medium border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RotateCcw className={`w-4 h-4 ${replanning ? 'animate-spin' : ''}`} />
              {replanning ? 'Replanning...' : 'Replan'}
            </button>

            <button
              onClick={resetAll}
              className="px-4 py-2.5 rounded-xs text-sm font-medium text-gruv-light-3 hover:bg-white/5 transition-colors"
            >
              Reset
            </button>
          </div>

          {error && (
            <div className="rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 p-3 text-xs text-monokai-pink whitespace-pre-wrap">
              {error}
            </div>
          )}

          {plan && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-monokai-orange">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Plan Preview</span>
              </div>

              <div className="rounded-xs border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gruv-light-1 font-semibold">{plan.summary}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${plan.planner_source === 'stepbit-core' ? 'bg-monokai-green/15 text-monokai-green border-monokai-green/20' : 'bg-monokai-orange/15 text-monokai-orange border-monokai-orange/20'}`}>
                    {plan.planner_source}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {plan.stages.map((stage) => (
                    <div key={stage.id} className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gruv-light-1">{stage.title}</p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-monokai-aqua/15 text-monokai-aqua border border-monokai-aqua/20">
                          {stage.stage_type}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gruv-light-3 whitespace-pre-wrap">{stage.summary}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xs border border-white/10 bg-gruv-dark-0/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gruv-light-4 mb-2">Planner Notes</p>
                  <div className="space-y-1.5">
                    {plan.notes.map((note, idx) => (
                      <p key={idx} className="text-xs text-gruv-light-3">{note}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="glass rounded-xs border-white/10 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-monokai-orange" />
            <h2 className="text-lg font-semibold text-gruv-light-1">Execution Output</h2>
          </div>

          {!result ? (
            <div className="rounded-xs border border-dashed border-white/10 bg-black/20 p-4 text-xs text-gruv-light-4">
              Generate a plan first, then approve execution to inspect the final answer, stage-level progress, evidence, and raw payloads.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gruv-light-4 mb-1.5">Final Answer</div>
                <div className="rounded-xs bg-black/30 border border-white/5 p-3 whitespace-pre-wrap text-xs text-gruv-light-1">
                  {result.result?.final_answer || 'No final answer returned.'}
                </div>
              </div>

              {result.result?.stage_summaries && result.result.stage_summaries.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gruv-light-4 mb-1.5">Stage Progress</div>
                  <div className="space-y-2">
                    {result.result.stage_summaries.map((stage) => (
                      <div key={`${stage.index}-${stage.title}`} className="rounded-xs border border-white/10 bg-black/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-gruv-light-1">{stage.title}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${stage.status === 'completed' ? 'bg-monokai-green/15 text-monokai-green border-monokai-green/20' : stage.status === 'failed' ? 'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/20' : 'bg-gruv-dark-4 text-gruv-light-3 border-white/10'}`}>
                            {stage.status}
                          </span>
                        </div>
                        {stage.trace_excerpt && (
                          <p className="mt-2 text-[11px] text-gruv-light-3 whitespace-pre-wrap">{stage.trace_excerpt}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gruv-light-4 mb-1.5">Evidence</div>
                <div className="rounded-xs bg-black/30 border border-white/5 p-3">
                  <pre className="text-[11px] text-gruv-light-3 whitespace-pre-wrap font-mono">{JSON.stringify(result.result?.intermediate_results || [], null, 2)}</pre>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gruv-light-4 mb-1.5">Trace</div>
                <div className="rounded-xs bg-black/30 border border-white/5 p-3">
                  <pre className="text-[11px] text-monokai-aqua whitespace-pre-wrap font-mono">{JSON.stringify(result.result?.trace || [], null, 2)}</pre>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gruv-light-4 mb-1.5">Plan Payload</div>
                <div className="rounded-xs bg-black/30 border border-white/5 p-3">
                  <pre className="text-[11px] text-monokai-orange whitespace-pre-wrap font-mono">{JSON.stringify(result.plan, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}

          {failureReason && plan && (
            <div className="rounded-xs border border-monokai-orange/20 bg-monokai-orange/10 p-3">
              <div className="flex items-center gap-2 text-monokai-orange mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Replan Context</span>
              </div>
              <p className="text-xs text-gruv-light-2 whitespace-pre-wrap">{failureReason}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-4 py-3">
    <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
    <p className="mt-1.5 text-base font-semibold text-gruv-light-1">{value}</p>
  </div>
);

export default Goals;
