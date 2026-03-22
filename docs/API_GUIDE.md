# Stepbit API Guide 🛠️

This guide documents the REST and WebSocket endpoints available in the Stepbit LLM Server. 

---

## 🏗️ Authentication & Security

Stepbit uses a hybrid authentication model to balance ease of use with enterprise-grade security.

### 1. Bearer Token (Standard)
Most REST endpoints require an `Authorization: Bearer <API_KEY>` header.
- **Default Key**: `sk-dev-key-123` (Change this in `config.yaml`).

### 2. Chained Handshake (Remote stepbit-core)
When communicating with a remote `stepbit-core` instance, Stepbit uses a rotating token mechanism.
- **Header**: `X-API-Key` is used for the initial handshake.
- **Rotation**: stepbit-core provides a `X-Next-Token` in the response header. 
- **Next Request**: Stepbit must use that specific token.
- **Verification**: This prevents replay attacks and ensures zero-trust connectivity.

---

## 🧠 Cognitive Pipelines API

Execute structured reasoning workflows programmatically.

### `POST /api/pipelines/:id/execute`
Executes a pre-defined pipeline by its database ID.
- **Headers**: `Content-Type: application/json`
- **Body**: 
  ```json
  {
    "question": "What are the top 3 sessions with the most messages?",
    "rlm_enabled": false
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "final_answer": "The top 3 sessions are...",
    "trace": ["McpToolStage: executed query", "SynthesisStage: compiled answer"],
    "tool_calls": [...]
  }
  ```

---

## ⏰ Scheduled Jobs API

Manage recurring executions backed by the `stepbit-core` cron scheduler.

### `GET /api/cron/jobs`
Lists all registered cron jobs.

**Response**
```json
{
  "jobs": [
    {
      "id": "nightly_analysis",
      "schedule": "0 2 * * *",
      "execution_type": "Pipeline",
      "payload": {},
      "failure_count": 0,
      "last_failure_at": null,
      "next_retry_at": null,
      "last_run_at": null
    }
  ]
}
```

### `POST /api/cron/jobs`
Creates a new cron job.

**Body**
```json
{
  "id": "nightly_analysis",
  "schedule": "0 2 * * *",
  "execution_type": "Pipeline",
  "payload": {
    "question": "Run nightly analysis",
    "pipeline": {
      "name": "nightly_analysis",
      "stages": []
    }
  },
  "retry_policy": {
    "max_retries": 3,
    "backoff_ms": 300000
  }
}
```

### `POST /api/cron/jobs/:id/trigger`
Triggers an existing cron job immediately.

### `DELETE /api/cron/jobs/:id`
Deletes an existing cron job.

---

## 🔔 Events & Triggers API

Use these endpoints to register reactive automations and publish test events.

### `GET /api/triggers`
Lists all registered triggers.

### `POST /api/triggers`
Creates a trigger.

**Body**
```json
{
  "id": "file-processor",
  "event_type": "file.created",
  "condition": {
    "Equals": {
      "path": "extension",
      "value": ".pdf"
    }
  },
  "action": {
    "Goal": {
      "goal": "Inspect the new PDF and summarize it"
    }
  }
}
```

### `DELETE /api/triggers/:id`
Deletes a trigger by ID.

### `POST /api/events`
Publishes a manual event into `stepbit-core`.

**Body**
```json
{
  "event_type": "file.created",
  "payload": {
    "extension": ".pdf",
    "path": "/tmp/report.pdf"
  }
}
```

---

## 🏗️ Reasoning Graph API

Build and execute ad-hoc reasoning chains using a Directed Acyclic Graph (DAG).

### `POST /v1/reasoning/execute`
Executes a graph and waits for completion (Blocking).

### `POST /v1/reasoning/execute/stream` (Recommended)
Executes a graph and streams lifecycle events via **Server-Sent Events (SSE)**.
- **Events**:
  - `node_started`: `{"type": "node_started", "node_id": "..."}`
  - `node_completed`: `{"type": "node_completed", "node_id": "...", "result": {...}}`
  - `error`: `{"type": "error", "error": "..."}`
- **Key Features**: 
  - **Template Substitution**: Use `{{node_id.output}}` to link data flows.
  - **Parallel Execution**: Independent nodes execute concurrently.
  - **Fallback Simulation**: Gracefully returns mock results if no LLM engine is loaded.

---

---

## 💬 Chat & Streaming

### `WS /ws/chat/{session_id}`
Real-time, bidirectional communication.

**Client JSON**:
```json
{
  "type": "message",
  "content": "Analyze my DB usage",
  "search": true
}
```

**Server Enums**:
- `chunk`: A single token of text.
- `status`: A human-readable action (e.g. "Analyzing...").
- `trace`: A reasoning step from a pipeline.
- `done`: Signal for stream termination.

---

## ⚙️ Configuration

### `GET /config/active-provider`
Returns the current LLM orchestration state.
```json
{
  "provider": "ollama",
  "model": "mistral:latest",
  "status": "online"
}
```

---

## 📈 System Health

### `GET /health`
Verifies that the Rust kernel and DuckDB engine are active.
```json
{
  "status": "healthy",
  "api": "connected",
  "database": "connected",
  "stepbit-core": "connected"
}
```

### `GET /api/stepbit-core/status`
Returns enriched `stepbit-core` runtime information for the dashboard and operational UI.

**Response**
```json
{
  "online": true,
  "ready": true,
  "message": "stepbit-core is ready",
  "active_model": "mistral-7b",
  "supported_models": ["mistral-7b", "qwen-14b"],
  "metrics": {
    "requests_total": 42,
    "tokens_generated_total": 2048,
    "active_sessions": 3,
    "token_latency_avg_ms": 25
  }
}
```

For full request/response schemas, refer to the technical documentation within the `docs/` folder.
