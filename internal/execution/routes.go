package execution

import (
	"database/sql"
	"stepbit-app/internal/execution/handlers"
	"stepbit-app/internal/execution/services"

	"github.com/gofiber/fiber/v2"
)

type ExecutionModule struct {
	ExecutionHandler *handlers.ExecutionHandler
	ExecutionService *services.ExecutionService
}

func NewExecutionModule(db *sql.DB) *ExecutionModule {
	executionService := services.NewExecutionService(db)
	executionHandler := handlers.NewExecutionHandler(executionService)

	return &ExecutionModule{
		ExecutionHandler: executionHandler,
		ExecutionService: executionService,
	}
}

func (m *ExecutionModule) RegisterRoutes(app *fiber.App) {
	api := app.Group("/api/executions")
	api.Get("/", m.ExecutionHandler.ListRuns)
}
