package handlers

import (
	"stepbit-app/internal/execution/services"

	"github.com/gofiber/fiber/v2"
)

type ExecutionHandler struct {
	executionService *services.ExecutionService
}

func NewExecutionHandler(executionService *services.ExecutionService) *ExecutionHandler {
	return &ExecutionHandler{executionService: executionService}
}

func (h *ExecutionHandler) ListRuns(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 50)
	offset := c.QueryInt("offset", 0)

	runs, err := h.executionService.ListRuns(limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(runs)
}

func (h *ExecutionHandler) DeleteRun(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid execution id"})
	}

	if err := h.executionService.DeleteRun(int64(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *ExecutionHandler) DeleteAllRuns(c *fiber.Ctx) error {
	if err := h.executionService.DeleteAllRuns(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
