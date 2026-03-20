# TASK-09: Session Export (UI Implementation)

## Objective
Surface the existing backend export functionality in the React frontend.

## Agent Prompts
1. Update `Chat.tsx` to add an "Export" button in the active session header.
2. Implement `handleExport` to trigger a `.txt` download of the session messages.

## Testing
- **Sanity**: Export a session and verify the role/content pairs match the chat.
- **UI**: Verify the download icon fits the Monokai Pro aesthetic.

## Benchmark
- **Trigger-to-Save Latency**: Target < 200ms.
