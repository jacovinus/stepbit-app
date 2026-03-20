# TASK-10: Session Import (UI Implementation)

## Objective
Surface the existing backend import functionality in the React frontend.

## Agent Prompts
1. Create `ImportModal.tsx` for file upload or text pasting.
2. Hook the modal to the "New Chat" sidebar section.

## Testing
- **Portability**: Export a session from Rust version and import into Go version.
- **Validation**: Ensure no message duplication on re-import.

## Benchmark
- **Ingestion Time**: Target < 800ms for 50+ messages.
