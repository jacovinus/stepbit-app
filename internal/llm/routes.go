package llm

import (
	"stepbit-app/internal/core"
	"stepbit-app/internal/llm/handlers"
	"stepbit-app/internal/llm/services"
	"github.com/gofiber/fiber/v2"
)

type LlmModule struct {
	LlmHandler *handlers.LlmHandler
	LlmService *services.LlmService
}

func NewLlmModule(coreClient *core.StepbitCoreClient) *LlmModule {
	llmService := services.NewLlmService(coreClient)
	llmHandler := handlers.NewLlmHandler(llmService)

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
	llm.Post("/reasoning/execute", m.LlmHandler.ExecuteReasoning)
	llm.Post("/reasoning/execute/stream", m.LlmHandler.ExecuteReasoningStream)

	// stepbit-core status
	api.Get("/stepbit-core/status", m.LlmHandler.GetCoreStatus)
}
