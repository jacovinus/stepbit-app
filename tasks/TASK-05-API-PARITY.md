# TASK-05: Full API Feature Parity

## Status: [/] In Progress

## Description
implement all REST endpoints from the original Rust backend to ensure full product functionality.

## Checklist
- [x] Create `tasks/TASK-05-API-PARITY.md` [x]
- [x] Expand `DbService` with full CRUD (List, Update, Delete) [x]
- [x] Implement Session CRUD routes in `internal/api/router.go` [x]
- [/] Implement Message history and Stats routes [/]
- [x] Implement Message history and Stats routes [x]
- [/] Implement Skills & Pipelines management routes [/]
- [ ] Implement SQL Query and Export/Import endpoints [ ]
- [ ] Verify parity with integration tests [ ]

## Verification
- Use `curl` or Postman to verify each endpoint.
- Ensure DuckDB state correctly reflects all operations.
- Compare JSON response structures with Rust baseline.
