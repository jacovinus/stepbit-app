# Task: Refactor - Storage and Database Modularization

## Description
Refactor the common storage logic (DuckDB) into a clean, reusable module. Consolidate `internal/db` and `internal/models/database.go` into `internal/storage`.

## Goals
- **Core Storage**: Create `internal/storage/duckdb/` to host the DuckDB connection and low-level initialization.
- **Repositories**: Instead of a global `DbService` with 50+ methods, use specialized repositories that the feature services can inject.
- **Migration**: Clean up `internal/db/schema.go` and ensure schemas are managed closer to the features or in a dedicated storage layer.
- **Security**: Implement strict input validation and parameterized queries as the default standard in the storage layer.

## Action Items
1. Move `DbService` initialization to `internal/storage`.
2. Split the massive `service.go` in `internal/db` into feature-specific repository interfaces.
3. Update all feature services to use the new repository interfaces instead of the global `DbService`.

## Verification
- Database initialization is successful.
- All CRUD operations across all features remain functional.
- Better separation of DuckDB-specific logic from business logic.
