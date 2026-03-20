# Task: Refactor - Centralized Routing and Router Merge

## Description
Implement the "Single Entry Point" for routing. Instead of a 1000-line `router.go`, the main router should only initialize the app, middleware, and merge feature routes.

## Goals
- **Register Routes**: The new `api/router.go` should look like this:
  ```go
  func (r *Router) RegisterRoutes() {
      session.RegisterRoutes(r.App, r.SessionService)
      skill.RegisterRoutes(r.App, r.SkillService)
      // ... etc
  }
  ```
- **Cleanup**: Remove 90% of the logic currently in `api/router.go`.
- **Middleware**: Standardize security middleware in a central location.

## Action Items
1. Create a `RegisterRoutes` method in each feature module.
2. Update `NewRouter` to call these registration methods.
3. Delete all legacy handlers from `api/router.go`.

## Verification
- All API endpoints are correctly registered and accessible.
- The `api/router.go` file is significantly reduced in size and complexity.
