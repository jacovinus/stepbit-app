package pipeline

import (
	"database/sql"
	"stepbit-app/internal/core"
	"stepbit-app/internal/pipeline/handlers"
	"stepbit-app/internal/pipeline/services"
	"github.com/gofiber/fiber/v2"
)

type PipelineModule struct {
	PipelineHandler *handlers.PipelineHandler
	PipelineService *services.PipelineService
}

func NewPipelineModule(db *sql.DB, coreClient *core.StepbitCoreClient) *PipelineModule {
	pipelineService := services.NewPipelineService(db)
	pipelineHandler := handlers.NewPipelineHandler(pipelineService, coreClient)

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
