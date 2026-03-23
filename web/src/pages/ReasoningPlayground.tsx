import React, { useMemo, useState } from 'react';
import ReasoningGraph, { type ReasoningNode } from '../components/ReasoningGraph';
import { executeReasoningStream } from '../api/llm';
import { AlertTriangle, CheckCircle, Database, Play, Settings2, Trash2, Wrench, Brain, List, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type GraphEdge = { from: string; to: string };

const ReasoningPlayground: React.FC = () => {
  const [nodes, setNodes] = useState<Record<string, ReasoningNode>>({
    'node-1': {
      id: 'node-1',
      node_type: 'LlmGeneration',
      payload: { prompt: 'Who is the CEO of Google?' },
      position: { x: 50, y: 50 }
    },
    'node-2': {
      id: 'node-2',
      node_type: 'Summarization',
      payload: { input: '{{node-1.output}}' },
      position: { x: 350, y: 150 }
    }
  });

  const [edges, setEdges] = useState<GraphEdge[]>([
    { from: 'node-1', to: 'node-2' }
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<Record<string, any>>({});
  const [eventLog, setEventLog] = useState<Array<{ type: string; nodeId?: string; message: string }>>([]);
  const [executionError, setExecutionError] = useState('');

  const validation = useMemo(() => validateGraph(nodes, edges), [nodes, edges]);
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null;

  const handleNodeMove = (id: string, x: number, y: number) => {
    setNodes(prev => ({
      ...prev,
      [id]: { ...prev[id], position: { x, y } }
    }));
  };

  const addNode = (type: string) => {
    const id = `node-${Date.now().toString().slice(-4)}`;
    const newNode: ReasoningNode = {
      id,
      node_type: type,
      payload: type === 'LlmGeneration' ? { prompt: '' } :
        type === 'McpToolCall' ? { tool: '', input: {} } :
        type === 'DataQuery' ? { tool: 'duckdb_query', input: { query: '' } } : {},
      position: { x: 100, y: 100 },
      status: 'pending'
    };
    setNodes(prev => ({ ...prev, [id]: newNode }));
    setSelectedNodeId(id);
  };

  const deleteNode = (id: string) => {
    const newNodes = { ...nodes };
    delete newNodes[id];
    setNodes(newNodes);
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const addEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    if (edges.some(e => e.from === fromId && e.to === toId)) return;
    setEdges(prev => [...prev, { from: fromId, to: toId }]);
  };

  const removeEdge = (index: number) => {
    setEdges(prev => prev.filter((_, i) => i !== index));
  };

  const handleExecute = async () => {
    if (!validation.valid) return;

    setExecuting(true);
    setResults({});
    setEventLog([]);
    setExecutionError('');

    setNodes(prev => {
      const reset = { ...prev };
      Object.keys(reset).forEach(k => {
        reset[k] = { ...reset[k], status: 'pending', result: undefined };
      });
      return reset;
    });

    try {
      const graphData = { nodes: { ...nodes }, edges: [...edges] };

      await executeReasoningStream(graphData, (event: any) => {
        if (event.type === 'node_completed') {
          const { node_id, result } = event;
          setResults(prev => ({ ...prev, [node_id]: result }));
          setNodes(prev => ({
            ...prev,
            [node_id]: { ...prev[node_id], status: 'success', result }
          }));
          setEventLog(prev => [{ type: 'node_completed', nodeId: node_id, message: `${node_id} completed successfully.` }, ...prev]);
        } else if (event.type === 'node_started') {
          const { node_id } = event;
          setNodes(prev => ({
            ...prev,
            [node_id]: { ...prev[node_id], status: 'running' }
          }));
          setEventLog(prev => [{ type: 'node_started', nodeId: node_id, message: `${node_id} started.` }, ...prev]);
        } else if (event.type === 'error') {
          const nodeId = event.node_id || undefined;
          setExecutionError(event.error || 'Unknown execution error');
          if (nodeId) {
            setNodes(prev => ({
              ...prev,
              [nodeId]: prev[nodeId] ? { ...prev[nodeId], status: 'error' } : prev[nodeId]
            }));
          }
          setEventLog(prev => [{ type: 'error', nodeId, message: event.error || 'Unknown execution error' }, ...prev]);
        }
      });

    } catch (e: any) {
      const message = `Execution failed: ${e.message || 'Unknown error'}.`;
      setExecutionError(message);
      setEventLog(prev => [{ type: 'error', message }, ...prev]);
    } finally {
      setExecuting(false);
    }
  };

  const clearGraph = () => {
    setNodes({});
    setEdges([]);
    setSelectedNodeId(null);
    setResults({});
    setEventLog([]);
    setExecutionError('');
  };

  return (
    <div className="min-h-screen bg-gruv-dark-0 flex flex-col">
      <div className="p-6 border-b border-gruv-dark-3 flex justify-between items-center bg-gruv-dark-1">
        <div className="flex items-center gap-4">
          <Zap className="w-8 h-8 text-monokai-orange" />
          <div>
            <h1 className="text-2xl font-bold text-gruv-light-0">Reasoning Playground</h1>
            <p className="text-xs text-gruv-light-4">Build a graph, validate it locally, then stream the runtime events already exposed by stepbit-core.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={clearGraph}
            className="btn-secondary flex items-center gap-2 px-4 border-monokai-pink/30 text-monokai-pink/70 hover:bg-monokai-pink/10"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
          <div className="flex p-1 bg-gruv-dark-0 rounded-lg border border-gruv-dark-4 mr-4">
            {[
              { type: 'LlmGeneration', icon: Brain, color: 'text-monokai-aqua' },
              { type: 'McpToolCall', icon: Wrench, color: 'text-monokai-green' },
              { type: 'DataQuery', icon: Database, color: 'text-monokai-orange' },
              { type: 'Summarization', icon: List, color: 'text-gruv-light-3' },
              { type: 'Verification', icon: CheckCircle, color: 'text-monokai-pink' },
            ].map(tool => (
              <button
                key={tool.type}
                onClick={() => addNode(tool.type)}
                className={`p-2 hover:bg-gruv-dark-3 rounded transition-colors ${tool.color}`}
                title={`Add ${tool.type}`}
              >
                <tool.icon size={18} />
              </button>
            ))}
          </div>

          <button
            onClick={handleExecute}
            disabled={executing || !validation.valid}
            className="btn-primary flex items-center gap-2 px-6 disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${executing ? 'animate-spin' : ''}`} />
            {executing ? 'Executing...' : 'Run Graph'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 p-4 border-b border-gruv-dark-3 bg-gruv-dark-1/60">
        <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`w-4 h-4 ${validation.valid ? 'text-monokai-green' : 'text-monokai-orange'}`} />
            <span className="text-xs font-black uppercase tracking-widest text-gruv-light-4">Graph Validation</span>
          </div>
          <div className="space-y-2">
            {validation.messages.length > 0 ? validation.messages.map((message, idx) => (
              <p key={idx} className={`text-sm ${validation.valid ? 'text-gruv-light-2' : 'text-monokai-orange'}`}>{message}</p>
            )) : <p className="text-sm text-gruv-light-2">Graph is ready to execute.</p>}
          </div>
        </div>

        <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gruv-light-4 mb-3">Runtime Snapshot</p>
          <div className="space-y-3">
            <Metric label="Nodes" value={String(Object.keys(nodes).length)} />
            <Metric label="Edges" value={String(edges.length)} />
            <Metric label="Completed" value={String(Object.values(nodes).filter((node) => node.status === 'success').length)} />
            <Metric label="Errors" value={String(Object.values(nodes).filter((node) => node.status === 'error').length)} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative overflow-auto p-4 flex flex-col gap-4">
          <ReasoningGraph
            nodes={nodes}
            edges={edges}
            onNodeMove={handleNodeMove}
            onNodeSelect={setSelectedNodeId}
            selectedNodeId={selectedNodeId || undefined}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-gruv-dark-1 rounded-xl border border-gruv-dark-3 flex flex-col h-72">
              <div className="p-4 border-b border-gruv-dark-3 flex justify-between items-center bg-gruv-dark-1/50">
                <h3 className="text-gruv-light-4 font-bold text-xs uppercase tracking-widest">Execution Log</h3>
                <span className="text-[10px] text-gruv-gray font-mono">{eventLog.length} events</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
                {eventLog.length === 0 && !executing && (
                  <div className="h-full flex items-center justify-center text-gruv-gray italic">
                    Run the graph to see live runtime events...
                  </div>
                )}
                {eventLog.map((event, idx) => (
                  <div key={`${event.type}-${event.nodeId || 'global'}-${idx}`} className="p-3 bg-gruv-dark-0 rounded border border-gruv-dark-4">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="text-monokai-aqua font-bold">{event.nodeId || 'runtime'}</div>
                      <div className={`text-[10px] px-1.5 py-0.5 rounded ${event.type === 'error' ? 'text-monokai-pink bg-monokai-pink/10' : event.type === 'node_completed' ? 'text-monokai-green bg-monokai-green/10' : 'text-monokai-orange bg-monokai-orange/10'}`}>
                        {event.type}
                      </div>
                    </div>
                    <div className="text-gruv-light-3 break-words whitespace-pre-wrap">{event.message}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gruv-dark-1 rounded-xl border border-gruv-dark-3 flex flex-col h-72">
              <div className="p-4 border-b border-gruv-dark-3 flex justify-between items-center bg-gruv-dark-1/50">
                <h3 className="text-gruv-light-4 font-bold text-xs uppercase tracking-widest">Node Results</h3>
                <span className="text-[10px] text-gruv-gray font-mono">{Object.keys(results).length} items</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
                {Object.keys(results).length === 0 && !executing && (
                  <div className="h-full flex items-center justify-center text-gruv-gray italic">
                    Completed node outputs will appear here.
                  </div>
                )}
                {Object.entries(results).reverse().map(([id, result]) => (
                  <div key={id} className="p-3 bg-gruv-dark-0 rounded border border-gruv-dark-4 hover:border-monokai-aqua/50 transition-colors group">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-monokai-aqua font-bold">{id}</div>
                      <div className="text-[10px] text-monokai-green bg-monokai-green/10 px-1.5 py-0.5 rounded">SUCCESS</div>
                    </div>
                    <div className="text-gruv-light-3 break-words whitespace-pre-wrap">
                      {typeof result.output === 'string' ? result.output : JSON.stringify(result, null, 2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {executionError && (
            <div className="rounded-xs border border-monokai-pink/30 bg-monokai-pink/10 p-4 text-sm text-monokai-pink whitespace-pre-wrap">
              {executionError}
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedNodeId && selectedNode && (
            <motion.div
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="w-[450px] bg-gruv-dark-1 border-l border-gruv-dark-3 p-6 space-y-6 overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-gruv-light-4" />
                  <h3 className="text-lg font-bold text-gruv-light-0">Node Inspector</h3>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="text-gruv-gray hover:text-gruv-light-1">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {selectedNode.status && (
                  <div className={`p-3 rounded-lg border flex items-center justify-between ${
                    selectedNode.status === 'success' ? 'bg-monokai-green/10 border-monokai-green/30 text-monokai-green' :
                      selectedNode.status === 'running' ? 'bg-monokai-orange/10 border-monokai-orange/30 text-monokai-orange' :
                        selectedNode.status === 'error' ? 'bg-monokai-pink/10 border-monokai-pink/30 text-monokai-pink' :
                          'bg-gruv-dark-0 border-gruv-dark-4 text-gruv-gray'
                  }`}>
                    <span className="text-xs font-bold uppercase tracking-wider">Status: {selectedNode.status}</span>
                    <div className={`w-2 h-2 rounded-full ${
                      selectedNode.status === 'success' ? 'bg-monokai-green' :
                        selectedNode.status === 'running' ? 'bg-monokai-orange animate-pulse' :
                          selectedNode.status === 'error' ? 'bg-monokai-pink' :
                            'bg-gruv-gray'
                    }`} />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-gruv-light-4 block mb-2 uppercase tracking-widest">Configuration (JSON)</label>
                  <textarea
                    className="w-full h-40 bg-gruv-dark-0 border border-gruv-dark-4 font-mono text-xs text-monokai-aqua p-3 rounded outline-none focus:border-monokai-aqua transition-colors"
                    value={JSON.stringify(selectedNode.payload, null, 2)}
                    onChange={(e) => {
                      try {
                        const newPayload = JSON.parse(e.target.value);
                        setNodes(prev => ({
                          ...prev,
                          [selectedNodeId]: { ...prev[selectedNodeId], payload: newPayload }
                        }));
                      } catch {
                        // Keep textarea editable without breaking while JSON is incomplete.
                      }
                    }}
                  />
                </div>

                {results[selectedNodeId] && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gruv-light-4 block uppercase tracking-widest">Execution Result</label>
                    <div className="w-full bg-gruv-dark-0 border border-monokai-green/30 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96">
                      <pre className="text-monokai-green whitespace-pre-wrap">
                        {typeof results[selectedNodeId].output === 'string'
                          ? results[selectedNodeId].output
                          : JSON.stringify(results[selectedNodeId], null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gruv-dark-4">
                  <label className="text-[10px] font-bold text-gruv-light-4 block mb-3 uppercase tracking-widest">Outbound Connections</label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <select
                        className="flex-1 bg-gruv-dark-0 border border-gruv-dark-4 text-sm text-gruv-light-2 p-2 rounded focus:border-monokai-aqua outline-none"
                        onChange={(e) => addEdge(selectedNodeId, e.target.value)}
                        value=""
                      >
                        <option value="">Add connection to...</option>
                        {Object.keys(nodes)
                          .filter(id => id !== selectedNodeId)
                          .map(id => <option key={id} value={id}>{id}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {edges.filter(e => e.from === selectedNodeId || e.to === selectedNodeId).map((e, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[10px] bg-gruv-dark-0 px-2 py-1.5 rounded border border-gruv-dark-4 text-gruv-light-3">
                          <span className="font-mono">{e.from} → {e.to}</span>
                          <button
                            onClick={() => removeEdge(edges.indexOf(e))}
                            className="text-monokai-pink hover:text-white transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => deleteNode(selectedNodeId)}
                    className="w-full p-3 bg-monokai-pink/5 border border-monokai-pink/30 text-monokai-pink rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-monokai-pink/20 transition-all"
                  >
                    <Trash2 size={16} /> Delete Node
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xs border border-white/10 bg-gruv-dark-0/60 px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
    <p className="mt-1.5 text-sm font-semibold text-gruv-light-1">{value}</p>
  </div>
);

const validateGraph = (nodes: Record<string, ReasoningNode>, edges: GraphEdge[]) => {
  const nodeIds = Object.keys(nodes);
  const messages: string[] = [];

  if (nodeIds.length === 0) {
    return { valid: false, messages: ['Add at least one node before running the graph.'] };
  }

  const missingPayloadNodes = nodeIds.filter((id) => {
    const node = nodes[id];
    if (node.node_type === 'LlmGeneration') {
      return !String(node.payload?.prompt || '').trim();
    }
    if (node.node_type === 'McpToolCall') {
      return !String(node.payload?.tool || '').trim();
    }
    if (node.node_type === 'DataQuery') {
      return !String(node.payload?.input?.query || '').trim();
    }
    return false;
  });

  if (missingPayloadNodes.length > 0) {
    messages.push(`Complete the required payload for: ${missingPayloadNodes.join(', ')}.`);
  }

  const invalidEdges = edges.filter((edge) => !nodes[edge.from] || !nodes[edge.to]);
  if (invalidEdges.length > 0) {
    messages.push('Remove edges that point to deleted or missing nodes.');
  }

  const disconnectedNodes = nodeIds.filter((id) => edges.every((edge) => edge.from !== id && edge.to !== id) && nodeIds.length > 1);
  if (disconnectedNodes.length > 0) {
    messages.push(`Disconnected nodes detected: ${disconnectedNodes.join(', ')}.`);
  }

  if (detectCycle(nodeIds, edges)) {
    messages.push('Graph contains a cycle. stepbit-core expects a DAG.');
  }

  if (messages.length === 0) {
    messages.push('Graph is structurally valid for the current client-side checks.');
  }

  return { valid: messages.length === 1 && messages[0].includes('structurally valid'), messages };
};

const detectCycle = (nodeIds: string[], edges: GraphEdge[]) => {
  const adjacency = new Map<string, string[]>();
  nodeIds.forEach((id) => adjacency.set(id, []));
  edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) || []) {
      if (dfs(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  return nodeIds.some((id) => dfs(id));
};

export default ReasoningPlayground;
