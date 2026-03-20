# TASK-12: Database Snapshot Utility

## Objective
Surface the backend snapshot capability in the Database Explorer.

## Agent Prompts
1. Add a "Snapshot" button to `DatabaseExplorer.tsx`.
2. Display a success toast with the system path of the generated `.db` file.

## Testing
- **Existence**: Verify the physical file is created in the specified path.
- **Integrity**: Open the snapshot with `duckdb` CLI and verify tables aren't corrupt.

## Benchmark
- **Block Time**: Target < 50ms (atomic copy).
