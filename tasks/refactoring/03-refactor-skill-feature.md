# Task: Refactor - Skill Management Feature

## Description
Modularize the skill management system. Currently, it is mixed with global DB services and router handlers.

## Goals
- **Models**: Define `Skill`, `CreateSkillRequest`, etc., in `internal/skill/models/`.
- **Services**: Create `internal/skill/services/skill_service.go` to wrap DuckDB skill operations.
- **Handlers**: Extract skill-related Fiber handlers to `internal/skill/handlers/`.
- **Routes**: Create `internal/skill/routes.go`.

## Action Items
1. Move skill-related database logic from `internal/db/service.go` to the new `skill_service.go`.
2. Clean up `api/router.go` by removing skill handlers.
3. Ensure skill preloading logic (if any) is also modularized.

## Verification
- List, Create, and Delete skills via `/api/skills` works as before.
- Skills are correctly persisted in DuckDB.
