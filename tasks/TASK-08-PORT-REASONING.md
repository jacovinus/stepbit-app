# TASK-08: Port Reasoning Backend

## Objective
Restore complex reasoning graph execution and streaming in Go for full feature parity.

## Agent Prompts
1. Update `internal/api/router.go` to add `POST /api/llm/reasoning/execute` and `/execute/stream`.
2. Implement `handleExecuteReasoning` by delegating to `r.Core.ExecuteReasoning`.
3. Implement `handleExecuteReasoningStream` using Fiber's streaming response/SSE.

## Testing
- **SSE Validation**: Verify real-time reasoning chunks appear in the UI console.
- **Failover**: Ensure errors in intermediate nodes are reported correctly.

## Benchmark
- **First-Token Latency**: Target < 500ms.
