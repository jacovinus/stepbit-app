# Task: Refactor - Modular Structure Initialization

## Description
This task involves setting up the base directory structure for the new "Feature-Based Modular" architecture. We will move away from a global `api`, `core`, and `db` layer towards self-contained feature modules.

## Goals
- Create the `internal/` subdirectories for each feature.
- Ensure each feature has placeholders for `handlers`, `models`, `controllers`, `services`, and `routes.go`.
- Define the new dependency flow: Handlers -> Controllers -> Services -> Models.

## Proposed Directory Structure
Create the following directories:
- `internal/session/`
    - `internal/session/handlers/`
    - `internal/session/controllers/`
    - `internal/session/services/`
    - `internal/session/models/`
- `internal/skill/`
    - `internal/skill/handlers/`
    - ... (same for all)
- `internal/pipeline/`
- `internal/storage/` (previously `db` and `models/database.go`)
- `internal/reasoning/` (previously parts of `api/router.go` and `core`)
- `internal/config/` (providers and model management)

## Verification
- Verify that the directories are created and contain `.gitkeep` (or empty placeholder files) to maintain the structure.
