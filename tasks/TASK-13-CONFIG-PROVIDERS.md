# TASK-13: Config Provider Routes (Models & Status)

## Objective
Implement all `/api/config/*` routes in the Go backend to power the ProviderSelector and Settings page.

## Background
The frontend (`ProviderSelector.tsx`, `Settings.tsx`) calls these API endpoints:
- `GET /api/config/providers` → List all LLM providers
- `POST /api/config/active-provider` → Switch active provider
- `GET /api/config/active-provider` → Get active provider detail (status, models, active_model)
- `POST /api/config/active-provider/verify` → Verify provider connection
- `GET /api/config/active-model` → Get current model ID
- `POST /api/config/active-model` → Set active model

## Agent Prompts
1. Add a `ProviderConfig` struct to the Router with fields: `ActiveProviderID`, `ActiveModelID`, `ProviderModels map[string][]string`.
2. Register 6 config routes in `router.go`.
3. Implement handlers that proxy to stepbit-core for model discovery, or use local config state.
4. Return responses matching the shape defined in `config.ts` (`ProviderInfo`, `ActiveProviderDetail`).

## Testing
- **API**: `curl GET /api/config/providers` returns valid JSON array of providers.
- **UI**: ProviderSelector dropdown shows providers with online/offline status.
- **UI**: Settings page shows model portfolio with selectable models.

## Benchmark
- Provider list latency: < 200ms.
