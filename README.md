# stepbit-app

`stepbit-app` is the application layer for the Stepbit ecosystem: a local-first LLM command center that combines chat, structured reasoning, automation, analytics, and operational visibility in one interface.

Built with Go, DuckDB, React 19, and Vite, it is designed to sit in front of `stepbit-core` and turn lower-level reasoning infrastructure into a usable product surface for day-to-day workflows.

## Why stepbit-app

`stepbit-app` is not just a chat UI. It is the control plane for working with local and pluggable AI systems:

- chat with streaming responses and persistent history
- manage reusable prompt skills
- create and run cognitive pipelines
- execute ad-hoc reasoning graphs
- schedule recurring jobs
- register event-driven triggers
- inspect execution history
- monitor `stepbit-core` readiness and runtime metrics
- query local data through DuckDB-backed tools

## Feature Highlights

### Conversational Workspace
- Real-time chat over WebSockets
- Local session persistence in DuckDB
- Session import/export
- Provider and model selection from the UI

### Reasoning & Automation
- Cognitive pipeline CRUD and execution
- Goal planning, approval, execution, and replan flow
- Optional `RLM` toggle for deeper recursive reasoning
- Reasoning Playground for graph-based execution
- Scheduled Jobs backed by `stepbit-core` cron endpoints
- Triggers and manual event publishing for reactive workflows

### Operations & Visibility
- Dashboard with API, database, and `stepbit-core` health
- Readiness-aware `stepbit-core` runtime panel
- Active model and discovered models visibility
- Runtime metrics such as requests, generated tokens, active sessions, and token latency
- Local execution history for actions initiated from the app

### Data & Tooling
- DuckDB-backed local memory layer
- SQL Explorer and database inspection flows
- MCP tool discovery plus execution playground
- QuantLab local adapter tool for running a local `quantlab` checkout through `main.py --json-request`
- Skill library for reusable prompt assets

## Product Surfaces

The current UI includes dedicated pages for:

- `Dashboard`
- `Chat`
- `Database`
- `SQL Explorer`
- `Skills`
- `MCP Tools`
- `Reasoning`
- `Pipelines`
- `Scheduled Jobs`
- `Triggers`
- `Executions`
- `Settings`

## Architecture

`stepbit-app` is organized as a Go backend with a React frontend:

- **Backend**: Go + Fiber
- **Database**: DuckDB
- **Frontend**: React 19 + TypeScript + Vite
- **Core Integration**: `stepbit-core` for reasoning, pipelines, cron, triggers, and advanced orchestration

High-level flow:

1. The React frontend talks to the Go API.
2. The Go API manages local state in DuckDB.
3. For advanced reasoning and automation, the API proxies requests to `stepbit-core`.
4. The UI surfaces both local application state and remote core capabilities in one place.

## Key Backend Modules

- `internal/session`: chat sessions, messages, import/export, stats
- `internal/skill`: skill storage and management
- `internal/pipeline`: pipeline CRUD and execution
- `internal/cron`: scheduled jobs proxy
- `internal/events`: triggers and event publishing proxy
- `internal/execution`: local execution history
- `internal/llm`: MCP, reasoning, and core status endpoints
- `internal/storage`: DuckDB connection and SQL tooling
- `internal/core`: client for `stepbit-core`

## Quick Start

### Prerequisites

- Go 1.24+
- pnpm 10+
- Node.js 24+
- a reachable `stepbit-core` instance if you want pipelines, reasoning, cron jobs, triggers, and richer operational features

### 1. Install backend dependencies

```bash
go mod tidy
```

### 2. Install frontend dependencies

```bash
cd web
pnpm install
cd ..
```

### 3. Start the backend

```bash
go run ./cmd/stepbit-app
```

### 4. Start the frontend

```bash
cd web
pnpm dev
```

### 5. Open the app

By default, the frontend runs in Vite dev mode and talks to the backend through the configured API base URL.

## Frontend Build

```bash
cd web
pnpm build
```

## Backend Test Flow

```bash
GOCACHE=$(pwd)/.gocache go test ./...
```

If your environment restricts writes outside the workspace, keeping `GOCACHE` local avoids build-cache permission issues.

## Benchmarks

The repository includes Go benchmarks for key service layers such as:

- session service
- pipeline service
- skill service

Example:

```bash
GOCACHE=$(pwd)/.gocache go test -bench . -run ^$ ./internal/session/services ./internal/pipeline/services ./internal/skill/services
```

## API Overview

The app exposes both product-facing routes and compatibility surfaces. Key areas include:

- `/api/sessions`
- `/api/skills`
- `/api/pipelines`
- `/api/cron/jobs`
- `/api/triggers`
- `/api/events`
- `/api/executions`
- `/api/llm/*`
- `/api/stepbit-core/status`
- `/api/v1/chat/completions`

For full request examples, see:

- [API Guide](/Users/joelguerra/Projects/ai_tools/stepbit-app/docs/API_GUIDE.md)
- [Features Guide](/Users/joelguerra/Projects/ai_tools/stepbit-app/docs/FEATURES_GUIDE.md)

## Current Position in the Stepbit Stack

`stepbit-app` is the operator-facing and user-facing product layer.

- `stepbit-app` owns the web experience, local persistence, and application workflows
- `stepbit-core` owns advanced reasoning, orchestration, cron, triggers, and lower-level execution capabilities

This separation allows the app to remain product-focused while still unlocking more advanced automation and reasoning features when `stepbit-core` is connected.

## Status

The application currently supports:

- local-first chat and persistence
- pipeline execution routed through `stepbit-core`
- goal planning with plan preview and replan support
- scheduled jobs UI
- triggers UI
- execution history
- operational dashboard with readiness-aware core monitoring and runtime warnings

The roadmap continues toward richer execution history, more advanced planner-driven flows, and deeper control-plane functionality.

## Documentation

- [Features Guide](/Users/joelguerra/Projects/ai_tools/stepbit-app/docs/FEATURES_GUIDE.md)
- [API Guide](/Users/joelguerra/Projects/ai_tools/stepbit-app/docs/API_GUIDE.md)
- [Architecture](/Users/joelguerra/Projects/ai_tools/stepbit-app/docs/ARCHITECTURE.md)
- [Deployment Guide](/Users/joelguerra/Projects/ai_tools/stepbit-app/docs/DEPLOYMENT_GUIDE.md)
- [Core Feature Gap Roadmap](/Users/joelguerra/Projects/ai_tools/stepbit-app/docs/CORE_FEATURE_GAP_ROADMAP.md)

## Development Notes

- Use `pnpm`, not `npm`, for frontend workflows.
- `stepbit-core` connectivity materially changes the available feature set.
- DuckDB is part of the product model, not just an implementation detail; it powers persistence, analytics, and several operator-facing workflows.

## License

Refer to the repository's license and project-level governance documents for usage and contribution expectations.
