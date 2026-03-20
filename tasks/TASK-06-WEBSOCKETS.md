# TASK-06: WebSocket Engine & Real-time Reasoning

## Status: [/] In Progress

## Description
Implement the real-time WebSocket engine for `ws_chat` to support streaming reasoning traces, "Thinking..." status updates, and client-side cancellation.

## Checklist
- [x] Create `tasks/TASK-06-WEBSOCKETS.md` [x]
- [x] Setup Fiber WebSocket middleware [x]
- [/] Implement `ws_chat` protocol (JSON messages) [/]
- [ ] Implement real-time reasoning trace / "Thinking..." status logic [ ]
- [ ] Implement tool execution feedback via WebSocket [ ]
- [ ] Implement client-side cancellation [ ]
- [ ] Verify with a WebSocket client script [ ]

## Verification
- Use a Go-based or JS-based WebSocket client to connect to `/api/ws/chat`.
- Verify reception of `status`, `token`, and `done` messages.
- Test cancellation by sending a `cancel` message during streaming.
