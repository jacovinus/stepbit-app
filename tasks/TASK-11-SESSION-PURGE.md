# TASK-11: Global Session Purge (UI Surface)

## Objective
Enable users to clear all sessions via a secured UI action.

## Agent Prompts
1. Add a "Purge All" button to the sidebar.
2. Implement a secondary confirmation modal to prevent accidental data loss.

## Testing
- **Safety**: Verify data is NOT deleted if "Cancel" is clicked.
- **Cleanup**: Verify SQL Explorer shows 0 sessions after purge.

## Benchmark
- **Perceived Latency**: Target < 100ms for UI reset.
