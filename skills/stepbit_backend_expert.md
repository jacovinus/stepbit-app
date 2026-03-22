---
description: Expert guidance on Stepbit Backend (Go/Fiber) architecture, DuckDB integration, and stepbit-core proxying.
---

# Stepbit Backend Expert Skill

Stepbit is a high-performance orchestration server written in Go, using `Fiber` and `DuckDB`.

## Technical Stack
- **Framework**: `Fiber` for high-throughput HTTP and WebSockets.
- **Database**: `DuckDB` used as an analytical conversation memory store (`chat.db`).
- **Authentication**: Header-based auth with support for Bearer tokens and rolling stepbit-core tokens.

## Architecture & Data Flow
- **Request Proxying**: The backend acts as a gateway for stepbit-core, injecting security headers and managing the rolling token handshake.
- **MCP Integration**: Proxies `GET /api/llm/mcp/tools` to stepbit-core for tool discovery.
- **Reasoning Execution**: Proxies `POST /api/llm/reasoning/execute` to the stepbit-core remote DAG engine.
- **WebSocket Hub**: Manages real-time bidirectional communication (`/ws`) for streaming responses and system status.

## Database Integration
- **DuckDB Service**: Centralized in `internal/db` and `internal/storage/duckdb`.
- **Schema Management**: Dynamic schema initialization and migration.
- **SQL Explorer**: Exposes the `POST /api/query` endpoint for raw SQL execution (restricted to allowed tables).

## Best Practices
- **Database Access**: Reuse the shared `*sql.DB` from the app service layer instead of opening ad-hoc connections in handlers.
- **Middleware**: New routes requiring authentication should stay under `/api` so they inherit the existing auth flow.
- **Health Checks**: `/api/health` should reflect both API and Database connectivity status.
- **TDD**: Implement regression tests close to the package they validate using Go `_test.go` files.
