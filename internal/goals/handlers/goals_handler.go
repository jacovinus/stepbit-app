package handlers

import (
	"stepbit-app/internal/core"
	executionServices "stepbit-app/internal/execution/services"
	"stepbit-app/internal/goals/models"
	"stepbit-app/internal/goals/services"

	"github.com/gofiber/fiber/v2"
)

type GoalsHandler struct {
	goalsService     *services.GoalsService
	executionService *executionServices.ExecutionService
	coreClient       *core.StepbitCoreClient
}

func NewGoalsHandler(goalsService *services.GoalsService, executionService *executionServices.ExecutionService, coreClient *core.StepbitCoreClient) *GoalsHandler {
	return &GoalsHandler{
		goalsService:     goalsService,
		executionService: executionService,
		coreClient:       coreClient,
	}
}

func (h *GoalsHandler) ExecuteGoal(c *fiber.Ctx) error {
	var req models.ExecuteGoalRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Goal == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "goal is required"})
	}

	execPayload := h.goalsService.BuildExecutionPayload(req)
	sourceID := h.goalsService.BuildSourceID(req.Goal)

	runID, runInsertErr := h.executionService.InsertRun("goal", sourceID, "execute_goal", execPayload)
	result, err := h.coreClient.ExecutePipeline(c.Context(), execPayload)
	if runInsertErr == nil {
		status := "completed"
		if err != nil {
			status = "failed"
		}
		_ = h.executionService.CompleteRun(runID, status, result, err)
	}
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"goal":     req.Goal,
		"pipeline": execPayload["pipeline"],
		"result":   result,
	})
}
