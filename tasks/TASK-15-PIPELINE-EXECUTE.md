# TASK-15: Pipeline Execution Route

## Objective
Add `POST /api/pipelines/:id/execute` to the Go backend for pipeline graph execution.

## Background
The frontend `Pipelines.tsx` calls `pipelinesApi.execute(id, question)` which hits `POST /api/pipelines/:id/execute`.
This route does NOT exist in the Go router yet.

## Agent Prompts
1. Add `POST /pipelines/:id/execute` route to `router.go`.
2. The handler should fetch the pipeline definition from DuckDB, then proxy the graph to stepbit-core for execution.
3. Return the execution result (final_answer, trace, tool_calls, intermediate_results).

## Testing
- **API**: Execute a simple pipeline and verify trace output.
- **UI**: Pipelines page "Run" button triggers execution and shows results.

## Benchmark
- Execution time depends on graph complexity — target < 5s for 2-node graphs.
