package handlers

import (
	"stepbit-app/internal/cron/models"
	"stepbit-app/internal/cron/services"
	executionServices "stepbit-app/internal/execution/services"

	"github.com/gofiber/fiber/v2"
)

type CronHandler struct {
	cronService      *services.CronService
	executionService *executionServices.ExecutionService
}

func NewCronHandler(cronService *services.CronService, executionService *executionServices.ExecutionService) *CronHandler {
	return &CronHandler{cronService: cronService, executionService: executionService}
}

func (h *CronHandler) ListCronJobs(c *fiber.Ctx) error {
	jobs, err := h.cronService.ListCronJobs(c.Context())
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"jobs": jobs})
}

func (h *CronHandler) CreateCronJob(c *fiber.Ctx) error {
	var req models.CreateCronJobRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.ID == "" || req.Schedule == "" || req.ExecutionType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id, schedule, and execution_type are required"})
	}

	if req.Payload == nil {
		req.Payload = map[string]interface{}{}
	}

	if err := h.cronService.CreateCronJob(c.Context(), req); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	if runID, err := h.executionService.InsertRun("cron_job", req.ID, "create_cron_job", req); err == nil {
		_ = h.executionService.CompleteRun(runID, "completed", fiber.Map{"status": "created"}, nil)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"status": "created"})
}

func (h *CronHandler) DeleteCronJob(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "job id is required"})
	}

	if err := h.cronService.DeleteCronJob(c.Context(), id); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	if runID, err := h.executionService.InsertRun("cron_job", id, "delete_cron_job", fiber.Map{"id": id}); err == nil {
		_ = h.executionService.CompleteRun(runID, "completed", fiber.Map{"status": "deleted"}, nil)
	}

	return c.JSON(fiber.Map{"status": "deleted"})
}

func (h *CronHandler) TriggerCronJob(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "job id is required"})
	}

	if err := h.cronService.TriggerCronJob(c.Context(), id); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	if runID, err := h.executionService.InsertRun("cron_job", id, "trigger_cron_job", fiber.Map{"id": id}); err == nil {
		_ = h.executionService.CompleteRun(runID, "completed", fiber.Map{"status": "triggered"}, nil)
	}

	return c.JSON(fiber.Map{"status": "triggered"})
}
