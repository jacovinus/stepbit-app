# Structured Agent Launch

This document closes the launch-readiness work for the structured agent chat path in `stepbit-app`.

## What Changed

- Chat now prefers the structured `/v1/responses` stream from `stepbit-core`.
- If the structured endpoint is unavailable, the app falls back to the legacy parser path.
- Selected chat skills are sent as `skill_ids` and converted into compact policy prompts on the backend instead of being prepended verbatim to the user message.

## Launch Checklist

Before calling the structured path launch-ready:

- `go test ./internal/core ./internal/session/services`
- `go test ./internal/session/services ./internal/skill/services ./internal/session`
- `go test ./...`
- `stepbit-core` is running with `STEPBIT_CORE_STRUCTURED_AGENT_CHAT=true`
- smoke-test these prompts in the chat UI:
  - "What time is it now?"
  - "What time is it in Europe/Madrid right now?"
  - "Search the latest renewable energy headlines"
  - a direct URL read request

## Expected Behavior

- No raw tool JSON should leak into the chat UI on the structured path.
- The user should see statuses such as `Running tool: ...`.
- Structured completions should persist assistant metadata with `structured=true`.
- If the core does not expose `/v1/responses`, the chat should continue working through the legacy fallback.

## Rollback

If the structured path regresses:

1. Disable `STEPBIT_CORE_STRUCTURED_AGENT_CHAT` on `stepbit-core`.
2. Restart the core.
3. `stepbit-app` will automatically fall back to the legacy streaming parser path.

## Skills Policy Notes

- Skills are now treated as policy/style layers, not pseudo-tool tutorials.
- The backend extracts:
  - allowed tools
  - citation expectations
  - table/conciseness preferences
- This reduces the tendency of the model to explain tools instead of using them.
