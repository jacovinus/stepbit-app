# TASK-14: Health Endpoint Restructuring

## Objective
Restructure the Go health endpoint to return JSON matching the frontend's expectations.

## Background
The frontend `useHealthCheck.ts` expects:
```json
{ "api": "connected", "database": "connected" }
```
The Go backend currently returns plain string `"OK"`.

## Agent Prompts
1. Modify `GET /api/health` to return a JSON object with `api` and `database` status fields.
2. Check actual DuckDB connectivity (`r.DB.Ping()` or similar) for the `database` field.
3. The `api` field should always be `"connected"` if the endpoint is reachable.

## Testing
- **API**: `curl GET /api/health` returns `{"api":"connected","database":"connected"}`.
- **UI**: Sidebar shows green dots for API and DB.

## Benchmark
- Response time: < 50ms.
