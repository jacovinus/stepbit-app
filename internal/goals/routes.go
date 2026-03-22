package goals

import (
	"database/sql"
	"stepbit-app/internal/core"
	executionServices "stepbit-app/internal/execution/services"
	"stepbit-app/internal/goals/handlers"
	"stepbit-app/internal/goals/services"

	"github.com/gofiber/fiber/v2"
)

type GoalsModule struct {
	GoalsHandler *handlers.GoalsHandler
	GoalsService *services.GoalsService
}

func NewGoalsModule(db *sql.DB, coreClient *core.StepbitCoreClient) *GoalsModule {
	goalsService := services.NewGoalsService()
	executionService := executionServices.NewExecutionService(db)
	goalsHandler := handlers.NewGoalsHandler(goalsService, executionService, coreClient)

	return &GoalsModule{
		GoalsHandler: goalsHandler,
		GoalsService: goalsService,
	}
}

func (m *GoalsModule) RegisterRoutes(app *fiber.App) {
	api := app.Group("/api/goals")
	api.Post("/execute", m.GoalsHandler.ExecuteGoal)
}
