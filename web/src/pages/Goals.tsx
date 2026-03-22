import React, { useState } from 'react';
import { Target, Play, Brain, RefreshCw, Sparkles } from 'lucide-react';
import { goalsApi, type GoalExecutionResult } from '../api/goals';
import { useStepbitCore } from '../hooks/useStepbitCore';

const Goals: React.FC = () => {
  const [goal, setGoal] = useState('');
  const [rlmEnabled, setRlmEnabled] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<GoalExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { online, loading: statusLoading, refresh: refreshStatus } = useStepbitCore();

  const handleExecute = async () => {
    if (!goal.trim()) {
      return;
    }

    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      const data = await goalsApi.execute(goal.trim(), rlmEnabled);
      setResult(data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to execute goal';
      setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="p-4 max-w-[1200px] mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xs bg-monokai-aqua/20 border border-monokai-aqua/30">
            <Target className="w-5 h-5 text-monokai-aqua" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gruv-light-0 tracking-tight">Goal Mode</h1>
            <p className="text-xs text-gruv-light-4 font-medium">Turn a high-level objective into a planner-driven execution pipeline</p>
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

      <div className="flex flex-wrap gap-4 items-start">
        <section className="glass rounded-xs border-white/10 p-4 space-y-4 flex-[1.15] min-w-[340px]">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gruv-light-1">Describe the objective</h2>
            <p className="text-xs text-gruv-light-4">
              The app will build a temporary pipeline with a <code className="font-mono text-monokai-aqua">planner_stage</code> and a <code className="font-mono text-monokai-aqua">synthesis_stage</code>, then execute it against <code className="font-mono text-monokai-aqua">stepbit-core</code>.
            </p>
          </div>

          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={8}
            placeholder="Example: Investigate the latest execution failures, summarize recurring patterns, and propose the next debugging steps."
            className="w-full bg-black/40 border border-white/5 rounded-xs px-3 py-2.5 text-xs text-gruv-light-1 focus:ring-2 focus:ring-monokai-aqua outline-none resize-y"
          />

          <label className="flex items-center justify-between gap-4 p-3 rounded-xs bg-black/20 border border-white/5">
            <div>
              <div className="text-xs font-semibold text-gruv-light-1">Enable Recursive Language Mode</div>
              <div className="text-[11px] text-gruv-light-4">Forward the request with <code className="font-mono text-monokai-orange">rlm_enabled</code> for deeper planner execution.</div>
            </div>
            <button
              type="button"
              onClick={() => setRlmEnabled(prev => !prev)}
              className={`relative w-12 h-7 rounded-xs transition-colors ${rlmEnabled ? 'bg-monokai-orange' : 'bg-gruv-dark-4'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-xs bg-white transition-transform ${rlmEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <div className="flex gap-4">
            <button
              onClick={handleExecute}
              disabled={executing || !online || !goal.trim()}
              className="flex items-center gap-2 bg-monokai-aqua text-gruv-dark-0 px-4 py-2.5 rounded-xs text-sm font-medium border border-monokai-aqua/70 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Play className={`w-4 h-4 ${executing ? 'animate-spin' : ''}`} />
              {executing ? 'Executing Goal...' : 'Execute Goal'}
            </button>

            <button
              onClick={() => {
                setGoal('');
                setError(null);
                setResult(null);
                setRlmEnabled(false);
              }}
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
        </section>

        <section className="glass rounded-xs border-white/10 p-4 space-y-3 flex-1 min-w-[320px]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-monokai-orange" />
            <h2 className="text-lg font-semibold text-gruv-light-1">Planner Output</h2>
          </div>

          {!result ? (
            <div className="rounded-xs border border-dashed border-white/10 bg-black/20 p-4 text-xs text-gruv-light-4">
              Run a goal to inspect the generated pipeline, trace, intermediate results, and final answer.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gruv-light-4 mb-1.5">Final Answer</div>
                <div className="rounded-xs bg-black/30 border border-white/5 p-3 whitespace-pre-wrap text-xs text-gruv-light-1">
                  {result.result?.final_answer || 'No final answer returned.'}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gruv-light-4 mb-1.5">Trace</div>
                <div className="rounded-xs bg-black/30 border border-white/5 p-3">
                  <pre className="text-[11px] text-monokai-aqua whitespace-pre-wrap font-mono">{JSON.stringify(result.result?.trace || [], null, 2)}</pre>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gruv-light-4 mb-1.5">Intermediate Results</div>
                <div className="rounded-xs bg-black/30 border border-white/5 p-3">
                  <pre className="text-[11px] text-gruv-light-3 whitespace-pre-wrap font-mono">{JSON.stringify(result.result?.intermediate_results || [], null, 2)}</pre>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gruv-light-4 mb-1.5">Generated Pipeline</div>
                <div className="rounded-xs bg-black/30 border border-white/5 p-3">
                  <pre className="text-[11px] text-monokai-orange whitespace-pre-wrap font-mono">{JSON.stringify(result.pipeline, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Goals;
