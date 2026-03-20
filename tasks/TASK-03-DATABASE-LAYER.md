# TASK-03: Database Layer (DuckDB)

## Status: [ ] Not Started

## Description
Migrate the DuckDB service layer from Rust to Go, ensuring schema parity and non-blocking snapshot support.

## Checklist
- [ ] Setup `go-duckdb` driver- [x] DuckDB connection setup [x]
- [x] Database schema creation [x]
- [x] Session and Message services [x]
- [x] Integration tests [x]
- [ ] Port `skills` and `pipelines` CRUD [ ]
- [ ] Implement analytical snapshotting logic [ ]
- [ ] Setup DB migration/init scripts [ ]

## Verification
- [ ] CRUD unit tests pass for all entities.
- [ ] Verify `chat.db` created by Go is readable by `stepbit-core`.
