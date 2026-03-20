# stepbit-app Specification

## 1. Objective
Provide a fast, reliable, and easily maintainable application layer that bridges the user interface with the local reasoning core.

## 2. API Design
The API implements standard REST and WebSocket protocols.

### 2.1 Endpoints
- `GET /health`: System health status.
- `POST /v1/chat/completions`: OpenAI-compatible chat.
- `GET /v1/sessions`: Session management.
- `POST /v1/pipelines/execute`: Directed Acyclic Graph execution.

## 3. Data Integrity
- All session and message data is persisted in `chat.db` (DuckDB).
- Schema must remain compatible with `stepbit-core` snapshotting.

## 4. Performance Requirements
- **TTFT**: < 50ms overhead from the application layer.
- **Concurrent Connections**: Support > 100 simultaneous streams on consumer hardware.
