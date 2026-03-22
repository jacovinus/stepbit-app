package pipeline

import (
	"database/sql"
	"github.com/gofiber/fiber/v2"
	"stepbit-app/internal/core"
	executionServices "stepbit-app/internal/execution/services"
	"stepbit-app/internal/pipeline/handlers"
	pipelineServices "stepbit-app/internal/pipeline/services"
)

type PipelineModule struct {
	PipelineHandler *handlers.PipelineHandler
	PipelineService *pipelineServices.PipelineService
}

func NewPipelineModule(db *sql.DB, coreClient *core.StepbitCoreClient) *PipelineModule {
	pipelineService := pipelineServices.NewPipelineService(db)
	executionService := executionServices.NewExecutionService(db)
	pipelineHandler := handlers.NewPipelineHandler(pipelineService, executionService, coreClient)

	return &PipelineModule{
		PipelineHandler: pipelineHandler,
		PipelineService: pipelineService,
	}
}

func (m *PipelineModule) RegisterRoutes(app *fiber.App) {
	api := app.Group("/api/pipelines")

	api.Get("/", m.PipelineHandler.ListPipelines)
	api.Post("/", m.PipelineHandler.CreatePipeline)
	api.Get("/:id", m.PipelineHandler.GetPipeline)
	api.Patch("/:id", m.PipelineHandler.UpdatePipeline)
	api.Delete("/:id", m.PipelineHandler.DeletePipeline)
	api.Post("/:id/execute", m.PipelineHandler.ExecutePipeline)
}
