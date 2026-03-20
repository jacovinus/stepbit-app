# TASK- [x] StepbitCore client implementation [x]
- [x] Token rotation logic [x]
- [x] SSE streaming support [x]
- [x] Verification tests [x]

## Description
Implement the HTTP client that communicates with `stepbit-core`, including the rotating token handshake and SSE streaming support.

## Checklist
- [ ] Implement `StepbitCoreClient` struct [ ]
- [ ] Implement Rotating Token Handshake logic (Middleware/Decorator) [ ]
- [ ] Implement `/v1/chat/completions` proxy (JSON) [ ]
- [ ] Implement SSE Stream forwarding with Context cancellation [ ]
- [ ] Implement `/v1/reasoning/execute` integration [ ]
- [ ] Implement `/v1/mcp/tools` integration [ ]

## Verification
- [ ] Unit tests for token rotation success/failure.
- [ ] Integration test: Successfully retrieve models from `stepbit-core`.
- [ ] Integration test: Verify stream stops when context is cancelled.
