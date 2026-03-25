# Rust Stepbit Parity Matrix

This document captures the current feature-parity status between the original Rust `stepbit` app and the Go `stepbit-app`.

It exists to support issue [#2](https://github.com/jacovinus/stepbit-app/issues/2) and its staged migration plan.

## Summary

`stepbit-app` already surpasses the original Rust app in several `stepbit-core` integration areas:

- goals and plan preview flows
- MCP provider management and MCP tool playground
- richer system/runtime visibility
- cron, triggers, and execution-history surfaces

The main regression is in the primary chat experience:

- the chat UI still exposes `search` and `reason` toggles
- chat cancellation is still not wired through to an active upstream request
- `skills/fetch-url` parity is still pending on the Go backend

## Parity Matrix

| Area | Rust `stepbit` | Go `stepbit-app` | Status |
| --- | --- | --- | --- |
| WebSocket chat | Present | Present | Complete |
| Token streaming | Present | Present | Complete |
| Chat status messages | Present | Present | Complete |
| Search toggle in chat | Real effect through tools | Flag forwarded end-to-end, but still no real web-search execution | Partial |
| Reason toggle in chat | Real effect on chat flow | Flag forwarded end-to-end, deeper chat behavior still limited | Partial |
| Tool-call loop in chat | Present | Missing | Gap |
| `internet_search` tool | Present | Missing | Gap |
| `read_url` tool | Present | Missing | Gap |
| `read_full_content` tool | Present | Missing | Gap |
| Tool result persistence in chat | Present | Missing | Gap |
| Real chat cancellation | Present | Missing | Gap |
| Skills CRUD | Present | Present | Complete |
| `skills/fetch-url` backend | Present | Frontend expects it, backend parity unclear/missing | Gap |
| Reasoning HTTP/stream | Present | Present | Complete |
| Pipelines | Present | Present | Complete |
| Goals flow | More limited | Present and richer | Go-better |
| MCP provider/catalog surfaces | Limited/older | Present and richer | Go-better |
| System/runtime diagnostics | More limited | Present and richer | Go-better |

## Highest-Priority Gaps

1. Restore real cancellation semantics.
2. Close residual endpoint/UI parity such as `skills/fetch-url`.
3. Audit the OpenAI-compatible chat proxy for the same agentic tool behavior if we want parity outside the websocket path.

## Stage Mapping

- [#3](https://github.com/jacovinus/stepbit-app/issues/3): baseline and regression coverage
- [#4](https://github.com/jacovinus/stepbit-app/issues/4): request-contract parity for `search` and `reason` - done in grouped chat parity PR
- [#5](https://github.com/jacovinus/stepbit-app/issues/5): Go tool registry + web research tools - done in grouped chat parity PR
- [#6](https://github.com/jacovinus/stepbit-app/issues/6): websocket chat tool-call loop - done in grouped chat parity PR
- [#7](https://github.com/jacovinus/stepbit-app/issues/7): cancellation parity
- [#8](https://github.com/jacovinus/stepbit-app/issues/8): residual parity cleanup and migration docs
