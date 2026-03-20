# TASK-07: Port MCP Tools Backend

## Objective
Restore the ability to list and inspect MCP tools in the Go backend to regain parity with the original Stepbit project.

## Agent Prompts
1. Update `internal/api/router.go` to add `GET /api/llm/mcp/tools`.
2. Implement `handleListMCPTools` in `router.go` by calling `r.Core.GetMCPTools()`.
3. Verify that the `models.MCPTool` struct exists in `internal/models/`.

## Testing
- **API**: Call `GET /api/llm/mcp/tools` via `curl` with `X-API-Key`.
- **UI**: Navigate to the MCP Tools page and verify the table populates.

## Benchmark
- **Discovery Latency**: Target < 300ms.
