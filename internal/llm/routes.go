package llm

import (
	"database/sql"
	"github.com/gofiber/fiber/v2"
	"stepbit-app/internal/core"
	executionServices "stepbit-app/internal/execution/services"
	"stepbit-app/internal/llm/handlers"
	"stepbit-app/internal/llm/services"
)

type LlmModule struct {
	LlmHandler *handlers.LlmHandler
	LlmService *services.LlmService
}

func NewLlmModule(db *sql.DB, coreClient *core.StepbitCoreClient) *LlmModule {
	llmService := services.NewLlmService(coreClient)
	executionService := executionServices.NewExecutionService(db)
	llmHandler := handlers.NewLlmHandler(llmService, executionService)

	return &LlmModule{
		LlmHandler: llmHandler,
		LlmService: llmService,
	}
}

func (m *LlmModule) RegisterRoutes(app *fiber.App) {
	api := app.Group("/api")

	// LLM Proxy (stepbit-core passthrough)
	llm := api.Group("/llm")
	llm.Get("/mcp/tools", m.LlmHandler.ListMCPTools)
	llm.Get("/mcp/providers", m.LlmHandler.ListMCPProviders)
	llm.Get("/mcp/providers/:provider/doc", m.LlmHandler.GetMCPProviderDoc)
	llm.Get("/core/health", m.LlmHandler.GetCoreHealthReport)
	llm.Get("/core/readiness", m.LlmHandler.GetCoreReadinessReport)
	llm.Get("/core/runtime", m.LlmHandler.GetCoreSystemRuntime)
	llm.Get("/core/cron-status", m.LlmHandler.GetCoreCronStatus)
	llm.Get("/core/recent-events", m.LlmHandler.GetCoreRecentEvents)
	llm.Get("/artifacts", m.LlmHandler.GetArtifact)
	llm.Delete("/artifacts", m.LlmHandler.DeleteArtifact)
	llm.Post("/mcp/tools/:tool/execute", m.LlmHandler.ExecuteMCPTool)
	llm.Post("/reasoning/execute", m.LlmHandler.ExecuteReasoning)
	llm.Post("/reasoning/execute/stream", m.LlmHandler.ExecuteReasoningStream)

	// stepbit-core status
	api.Get("/stepbit-core/status", m.LlmHandler.GetCoreStatus)
}
