# Task: Refactor - LLM and Reasoning Feature

## Description
Extract the LLM proxy, MCP tool listing, and Reasoning execution logic into a dedicated `internal/reasoning` feature.

## Goals
- **Proxy Logic**: Move the OpenAI-compatible chat completions and `stepbit-core` passthrough logic to `internal/reasoning/handlers/`.
- **Reasoning Service**: Create a service to manage reasoning execution (execute/stream).
- **Tool Management**: Extract MCP tool discovery and management.
- **Clean Core**: Reduce `internal/core/client.go` to just a low-level client, moving higher-level orchestration to the Reasoning feature.

## Action Items
1. Create `internal/reasoning/handlers/llm_handler.go`.
2. Move reasoning execution logic from `router.go` to `internal/reasoning/services/reasoning_service.go`.
3. Register routes in `internal/reasoning/routes.go`.

## Verification
- `/api/llm/reasoning/execute` still works correctly.
- OpenAI-compatible `/v1/chat/completions` responds correctly.
- MCP tools are still discoverable.
