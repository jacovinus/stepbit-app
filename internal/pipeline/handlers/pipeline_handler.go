package handlers

import (
	"github.com/gofiber/fiber/v2"
	"stepbit-app/internal/core"
	executionServices "stepbit-app/internal/execution/services"
	"stepbit-app/internal/pipeline/models"
	"stepbit-app/internal/pipeline/services"
)

type PipelineHandler struct {
	pipelineService  *services.PipelineService
	executionService *executionServices.ExecutionService
	coreClient       *core.StepbitCoreClient
}

func NewPipelineHandler(pipelineService *services.PipelineService, executionService *executionServices.ExecutionService, coreClient *core.StepbitCoreClient) *PipelineHandler {
	return &PipelineHandler{
		pipelineService:  pipelineService,
		executionService: executionService,
		coreClient:       coreClient,
	}
}

func (h *PipelineHandler) ListPipelines(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 100)
	offset := c.QueryInt("offset", 0)

	pipelines, err := h.pipelineService.ListPipelines(limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(pipelines)
}

func (h *PipelineHandler) CreatePipeline(c *fiber.Ctx) error {
	var req models.CreatePipelineRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	pipeline := &models.Pipeline{
		Name:       req.Name,
		Definition: req.Definition,
	}

	id, err := h.pipelineService.InsertPipeline(pipeline)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	newPipeline, _ := h.pipelineService.GetPipeline(id)
	return c.Status(fiber.StatusCreated).JSON(newPipeline)
}

func (h *PipelineHandler) GetPipeline(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	pipeline, err := h.pipelineService.GetPipeline(int64(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pipeline not found"})
	}
	return c.JSON(pipeline)
}

func (h *PipelineHandler) UpdatePipeline(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var req models.UpdatePipelineRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	pipeline, err := h.pipelineService.GetPipeline(int64(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pipeline not found"})
	}

	if req.Name != nil {
		pipeline.Name = *req.Name
	}
	if req.Definition != nil {
		pipeline.Definition = req.Definition
	}

	if err := h.pipelineService.UpdatePipeline(int64(id), pipeline); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	newPipeline, _ := h.pipelineService.GetPipeline(int64(id))
	return c.JSON(newPipeline)
}

func (h *PipelineHandler) DeletePipeline(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	if err := h.pipelineService.DeletePipeline(int64(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *PipelineHandler) ExecutePipeline(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	pipeline, err := h.pipelineService.GetPipeline(int64(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pipeline not found"})
	}

	var input struct {
		Question   string `json:"question"`
		RlmEnabled bool   `json:"rlm_enabled"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// Build the execution payload with pipeline definition + question
	execPayload := map[string]interface{}{
		"pipeline":    pipeline.Definition,
		"question":    input.Question,
		"rlm_enabled": input.RlmEnabled,
	}

	runID, runInsertErr := h.executionService.InsertRun("pipeline", c.Params("id"), "execute_pipeline", execPayload)
	result, err := h.coreClient.ExecutePipeline(c.Context(), execPayload)
	if runInsertErr == nil {
		status := "completed"
		if err != nil {
			status = "failed"
		}
		result = core.NormalizeExecutionResult(result, pipeline.Definition)
		_ = h.executionService.CompleteRun(runID, status, result, err)
	}
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	result = core.NormalizeExecutionResult(result, pipeline.Definition)
	return c.JSON(result)
}
