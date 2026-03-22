import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { executionsApi, type ExecutionRun } from '../api/executions';
import { Activity, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';

const ExecutionHistory: React.FC = () => {
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'running'>('all');

  useEffect(() => {
    void loadRuns();
  }, []);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const data = await executionsApi.list();
      setRuns(data);
    } catch (error) {
      console.error('Failed to load execution history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRuns = useMemo(() => {
    if (statusFilter === 'all') return runs;
    return runs.filter((run) => run.status === statusFilter);
  }, [runs, statusFilter]);

  return (
    <div className="p-4 max-w-6xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xs bg-monokai-green/20 border border-monokai-green/30">
            <Clock3 className="w-5 h-5 text-monokai-green" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gruv-light-0 tracking-tight">Execution History</h1>
            <p className="text-xs text-gruv-light-4 font-medium">Local history of actions triggered from stepbit-app across pipelines, jobs, triggers, and events.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xs border border-white/10 bg-white/5 p-1.5">
            {(['all', 'completed', 'failed', 'running'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1.5 rounded-xs text-xs font-semibold transition-colors ${statusFilter === status ? 'bg-monokai-green text-black' : 'text-gruv-light-3 hover:bg-white/10'}`}
              >
                {status}
              </button>
            ))}
          </div>
          <button
            onClick={() => void loadRuns()}
            className="p-2 rounded-xs bg-white/5 hover:bg-white/10 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gruv-light-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="h-28 rounded-xs bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-xs glass">
          <Activity className="w-8 h-8 text-gruv-light-4 mx-auto mb-3" />
          <p className="text-gruv-light-3 text-sm font-semibold">No execution history yet</p>
          <p className="text-xs text-gruv-light-4 mt-1.5">Run a pipeline, trigger a job, create a trigger, or publish an event to populate this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRuns.map((run, index) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className="rounded-xs border border-white/10 bg-white/5 p-3.5"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gruv-light-1">#{run.id}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-aqua/15 text-monokai-aqua border border-monokai-aqua/20">
                    {run.source_type}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gruv-dark-0 text-gruv-light-3 border border-white/10">
                    {run.action_type}
                  </span>
                  <StatusBadge status={run.status} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <RunStat label="Source ID" value={run.source_id} />
                  <RunStat label="Created" value={new Date(run.created_at).toLocaleString()} />
                  <RunStat label="Completed" value={run.completed_at ? new Date(run.completed_at).toLocaleString() : 'Pending'} />
                </div>

                <JsonDetails label="Request Payload" value={run.request_payload} />
                <JsonDetails label="Response Payload" value={run.response_payload} />

                {run.error && (
                  <div className="rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 px-3 py-2 text-xs text-monokai-pink">
                    {run.error}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'completed') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-green/15 text-monokai-green border border-monokai-green/20"><CheckCircle2 className="w-3 h-3" />completed</span>;
  }
  if (status === 'failed') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-pink/15 text-monokai-pink border border-monokai-pink/20"><XCircle className="w-3 h-3" />failed</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-monokai-orange/15 text-monokai-orange border border-monokai-orange/20"><Clock3 className="w-3 h-3" />running</span>;
};

const RunStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
    <p className="mt-1.5 text-xs font-semibold text-gruv-light-1 break-words">{value}</p>
  </div>
);

const JsonDetails = ({ label, value }: { label: string; value: any }) => (
  <details className="rounded-xs border border-white/10 bg-gruv-dark-0/70">
    <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-gruv-light-3">{label}</summary>
    <pre className="px-3 pb-3 text-[11px] text-monokai-green overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  </details>
);

export default ExecutionHistory;
