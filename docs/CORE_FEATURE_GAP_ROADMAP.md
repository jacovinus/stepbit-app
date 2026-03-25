# Stepbit Core -> Stepbit App Gap Roadmap

This document captures the main `stepbit-core` capabilities that are not yet fully surfaced in `stepbit-app`, along with a practical implementation roadmap.

For Rust-to-Go app parity specifically, see [RUST_PARITY_MATRIX.md](/Users/joelguerra/Projects/ai_tools/stepbit-app/docs/RUST_PARITY_MATRIX.md).

## Rust Chat Parity Status

The highest-priority Rust parity work for the chat surface is now split into three grouped deliveries instead of micro-PRs:

1. Chat parity foundation
   - closes `#4`, `#5`, and `#6`
   - forwards `search` and `reason`
   - restores web research tools
   - restores the websocket chat tool-call loop
2. Chat runtime parity
   - targets `#7`
   - restores real cancellation semantics and active-run tracking
3. Residual parity cleanup
   - targets `#8`
   - closes `skills/fetch-url` and remaining migration/docs gaps

Status update:
- chat parity foundation is done
- chat runtime cancellation parity is done
- residual parity cleanup closes the remaining Rust-era `skills/fetch-url` gap and finalizes the migration notes

## Goal

Turn `stepbit-app` from a solid manual workflow UI into a full control plane for the more advanced orchestration, automation, and observability features already developed in `stepbit-core`.

## Summary

`stepbit-app` already reflects:

- chat and streaming
- skills CRUD
- pipelines CRUD and execution
- reasoning execution and streaming
- MCP tool listing and execution playground
- storage/query tools
- provider/model configuration
- scheduled jobs management
- triggers management and manual event publishing
- goal plan preview, approval, execute, and replan flow
- execution history

The main product gaps are:

- deeper orchestrator observability
- distributed execution visibility
- plan memory and reuse
- guided reasoning builder validation
- orchestrator and runtime observability

## Feature Matrix

| Core Feature | Current App Status | Gap | Priority | Effort |
| --- | --- | --- | --- | --- |
| Cron scheduler / scheduled jobs | Partial | Exists, but still relies too heavily on raw payload editing and lacks richer validation | High | Medium |
| Event bus and triggers | Partial | Exists, but needs richer event debugging and more guided rule construction | High | Medium-High |
| Planner / goal mode | Partial | Plan/execute/replan exists in app-managed form; missing native planner endpoints and plan memory | High | High |
| Orchestrator observability | Partial | No admission, queue, runtime, or execution visibility | High | Medium |
| Advanced pipeline execution | Partial | Missing stage streaming, RLM toggle, retries, richer traces | High | Medium |
| MCP catalog UX | Partial | Playground exists; still missing richer examples, saved runs, and schema-driven forms | Medium | Medium |
| Advanced reasoning builder | Partial | Playground exists, but lacks guided builder and validation UX | Medium | Medium-High |
| Core health / readiness / metrics | Partial | Dashboard is too shallow for operations | High | Low-Medium |
| Distributed execution / workers | Missing | No cluster or worker visibility in app | Medium | High |
| Plan memory / plan history | Missing | No reuse, search, or plan comparison UX | Medium | Medium |

## Recommended Delivery Phases

### Phase 1: Operational Foundations

Focus on the highest-leverage features that make existing core capabilities usable in day-to-day workflows.

- Scheduled Jobs
- Core Ops Dashboard
- Advanced Pipeline Execution
- Basic Execution History

### Phase 2: Reactive and Autonomous Workflows

Expose the mechanisms that make `stepbit-core` feel like an automation platform rather than only a manual UI.

- Triggers and Event Rules
- Event Log Viewer
- Goal Mode / Planner
- Better MCP Tooling UX

### Phase 3: Advanced Control Plane

Surface the most powerful infrastructure-level features for scale and advanced users.

- Distributed worker visibility
- Plan memory and plan reuse
- Advanced graph builder
- Orchestrator queue and admission tooling

## Epic 1: Scheduled Jobs

### User Story

As a user, I want to schedule pipelines or reasoning runs so recurring analysis can happen automatically.

### Core Dependency

`stepbit-core` cron APIs and job execution.

Relevant references:

- `stepbit-core/docs/cron_scheduler.md`

### App Backend Changes

Create `internal/cron` with:

- `routes.go`
- `handlers/cron_handler.go`
- `services/cron_service.go`
- `models/models.go`

Add API proxy support for:

- `GET /api/cron/jobs`
- `POST /api/cron/jobs`
- `DELETE /api/cron/jobs/:id`
- `POST /api/cron/jobs/:id/trigger`

Optional:

- local persistence for execution history if app-level caching is useful

### App Frontend Changes

Add a `Scheduled Jobs` page with:

- jobs table
- create/edit modal
- trigger-now action
- last run / next run / failure count display
- execution type badge for Pipeline vs Graph

### Acceptance Criteria

- Users can create, list, delete, and trigger cron jobs from the app
- Users can see next scheduled run and last known run
- Failed API responses are shown clearly in UI

### Effort

5/10

## Epic 2: Event Triggers

### User Story

As a user, I want the system to react automatically to incoming events and execute pipelines or graphs.

### Core Dependency

`stepbit-core` event and trigger APIs.

Relevant references:

- `stepbit-core/docs/event_system.md`

### App Backend Changes

Create `internal/events` with support for:

- `POST /api/events`
- `GET /api/triggers`
- `POST /api/triggers`
- `DELETE /api/triggers/:id`

### App Frontend Changes

Add:

- `Triggers` page
- event log viewer
- trigger creation flow:
  - event type
  - condition/filter
  - action target
  - payload preview

### Acceptance Criteria

- Users can register and delete triggers
- Users can view recent events
- Users can connect an event rule to a pipeline or graph

### Effort

6/10

## Epic 3: Goal Mode / Planner

### User Story

As a user, I want to describe a goal in natural language and review the generated plan before execution.

### Core Dependency

Planner and replan support in `stepbit-core`.

Relevant references:

- `stepbit-core/docs/planner.md`
- `stepbit-core/docs/reasoning_engine.md`
- `stepbit-core/docs/orchestrator.md`

### App Backend Changes

Add planner-facing proxy endpoints once the core interface is finalized, for example:

- `POST /api/goals/plan`
- `POST /api/goals/execute`
- `POST /api/goals/replan`

If these endpoints do not yet exist in the core, this epic depends on adding them there first.

### App Frontend Changes

Add a `Goals` page with:

- goal input
- generated plan preview
- editable steps or graph preview
- approve-and-run action
- replan action on failure

### Acceptance Criteria

- Users can submit a goal and receive a generated plan
- Users can inspect the plan before execution
- Failed plans can be replanned from UI

### Effort

8/10

## Epic 4: Core Ops Dashboard

### User Story

As an operator, I want to understand the real health and readiness of the core, not just whether an endpoint responds.

### Core Dependency

Core health, readiness, runtime, and metrics endpoints.

Relevant references:

- `stepbit-core/README.md`
- `stepbit-core/docs/orchestrator.md`
- `stepbit-core/docs/runtime.md`

### App Backend Changes

Extend current core status support to include:

- readiness
- loaded model
- active sessions
- request totals
- recent failures
- runtime resource state if available

### App Frontend Changes

Expand dashboard with:

- core online vs ready
- model loaded
- sessions active
- token latency
- request throughput
- warnings for admission or resource pressure

### Acceptance Criteria

- Dashboard distinguishes "online" from "ready"
- Dashboard shows at least one useful runtime metric beyond health
- Resource or readiness issues are visible without opening logs

### Effort

4/10

## Epic 5: Advanced Pipeline Execution

### User Story

As a user, I want to see pipeline execution stage by stage and have better controls for advanced runs.

### Core Dependency

Pipeline stage model, trace output, and RLM support in the core.

Relevant references:

- `stepbit-core/docs/cognitive_pipelines.md`

### App Backend Changes

Improve current pipeline execution integration so it supports:

- `rlm_enabled`
- streaming execution
- detailed trace payloads
- richer stage metadata
- optional retry / rerun hooks

### App Frontend Changes

Upgrade `Pipelines` page to support:

- stage-by-stage status
- tool call detail
- RLM toggle
- failure state and rerun flow
- better trace viewer

### Acceptance Criteria

- Users can execute a pipeline with optional RLM
- Users can see stage-level progress
- Users can inspect richer trace output than a plain string list

### Effort

5/10

## Epic 6: MCP Catalog and Tool Playground

### User Story

As a user, I want to inspect and test MCP tools directly without building a full graph first.

### Core Dependency

MCP registry metadata.

Relevant references:

- `stepbit-core/docs/mcp_duckdb.md`

### App Backend Changes

If needed, expand tool metadata support to include:

- schemas
- descriptions
- examples
- capability flags

### App Frontend Changes

Enhance `MCP Tools` page with:

- tool detail view
- schema rendering
- example inputs
- direct execution playground
- formatted result view

### Acceptance Criteria

- Users can inspect tool metadata
- Users can run a tool directly from UI
- Output is displayed in a readable structured format

### Effort

4/10

## Epic 7: Advanced Reasoning Builder

### User Story

As a power user, I want to build and validate reasoning graphs without hand-authoring large JSON blobs.

### Core Dependency

Reasoning graph execution and validation rules.

Relevant references:

- `stepbit-core/docs/reasoning_engine.md`

### App Backend Changes

Optional but helpful:

- graph validation endpoint
- graph template preview endpoint

### App Frontend Changes

Extend `ReasoningPlayground` into a guided builder with:

- node templates
- edge editor
- validation feedback
- saved graph presets
- template variable helper

### Acceptance Criteria

- Users can compose graphs with less raw JSON
- Invalid graphs are caught before execution
- Saved graph definitions are reusable

### Effort

7/10

## Epic 8: Distributed Execution Visibility

### User Story

As an operator, I want to understand cluster topology and worker health when using distributed execution.

### Core Dependency

Distributed controller/worker state in the core.

Relevant references:

- `stepbit-core/docs/orchestrator.md`

### App Backend Changes

Add cluster-facing proxy endpoints once available:

- workers list
- worker health
- assigned jobs or active tasks

### App Frontend Changes

Add `Cluster` page with:

- worker inventory
- worker status
- active jobs by worker
- failure indicators

### Acceptance Criteria

- Users can see whether workers are online
- Users can identify where jobs are running
- Worker failures are visible in app

### Effort

8/10

## Suggested Sprint Plan

### Sprint 1

- Scheduled Jobs backend and UI
- Core Ops dashboard improvements
- richer core status payload

### Sprint 2

- Advanced Pipeline Execution
- execution history
- RLM toggle and trace improvements

### Sprint 3

- Event triggers backend and UI
- event log viewer
- trigger-to-pipeline workflow

### Sprint 4

- Goal Mode / Planner
- plan preview and execution
- replan flow

## Suggested Initial GitHub Issues

### High Priority

1. Add cron job proxy module to `stepbit-app`
2. Build `Scheduled Jobs` page in the web UI
3. Enrich core status endpoint with readiness and runtime metrics
4. Upgrade pipeline execution to support `rlm_enabled` and stage-level traces
5. Add events and triggers proxy module to `stepbit-app`
6. Build `Triggers` page and event viewer

### Medium Priority

1. Add MCP tool detail and execution playground
2. Add goal-based planning UI
3. Add graph validation support to reasoning playground
4. Add execution history across pipelines and jobs

### Later

1. Add cluster and worker visibility page
2. Add plan history and plan reuse UX
3. Add orchestrator queue and admission visibility

## Notes

- The biggest product gap is not basic chat or pipeline CRUD. It is the missing control-plane surface for automation, reactivity, planning, and operations.
- `stepbit-core` already looks capable of powering a much more autonomous product than `stepbit-app` currently exposes.
- The fastest path to visible product value is to ship cron, triggers, richer pipeline execution, and a deeper ops dashboard first.
