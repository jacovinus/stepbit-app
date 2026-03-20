# TASK-16: Session Stats Route

## Objective
Add `GET /api/sessions/stats` for the Dashboard page metrics.

## Background
The frontend `Dashboard.tsx` calls `sessionsApi.getStats()` to fetch system-wide metrics.
This route hits `GET /api/stats` and expects response with session counts, message counts, token totals, and DB size.

## Agent Prompts
1. Verify `GET /api/stats` handler returns all fields expected by `Dashboard.tsx`:
   - `total_sessions`, `total_messages`, `total_tokens`, `db_size_bytes`
   - Memory breakdown (if available)
2. Ensure the `handleGetStats` function in `router.go` delegates to `r.DB.GetStats()` correctly.

## Testing
- **API**: `curl GET /api/stats` returns full metric payload.
- **UI**: Dashboard shows all stat cards populated.

## Benchmark
- Stats query latency: < 100ms.
