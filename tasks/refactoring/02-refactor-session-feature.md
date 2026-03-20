# Task: Refactor - Session Management Feature

## Description
Extract all session-related logic from the monolithic `api/router.go` and `core/client.go` into the new `internal/session` module.

## Goals
- **Models**: Move `Session` and `Message` models from `internal/models/database.go` to `internal/session/models/`.
- **Handlers**: Move session-related HTTP handlers (List, Get, Create, Update, Delete, Export, Import) from `api/router.go` to `internal/session/handlers/`.
- **Controllers/Services**: 
    - Create `internal/session/services/session_service.go` to handle DB interactions.
    - Create `internal/session/services/chat_service.go` to handle the WebSocket logic and core client streaming.
- **WebSocket**: Clean up the `handleWebSocket` and `handleWsChatMessage` logic from `router.go`.
- **Routes**: Define `internal/session/routes.go` to register all session-specific routes.

## Action Items
1. Define the `Session` and `Message` structs in `internal/session/models/`.
2. Implement CRUD operations in `internal/session/services/session_service.go`.
3. Port WebSocket handling to `internal/session/services/chat_service.go`.
4. Create the Fiber handlers in `internal/session/handlers/`.
5. Register routes in `internal/session/routes.go`.

## Verification
- Session CRUD operations still work correctly via API.
- WebSocket chat functionality remains stable and streams correctly.
