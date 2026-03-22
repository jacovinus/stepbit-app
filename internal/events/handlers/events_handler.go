package handlers

import (
	"stepbit-app/internal/events/models"
	"stepbit-app/internal/events/services"
	executionServices "stepbit-app/internal/execution/services"

	"github.com/gofiber/fiber/v2"
)

type EventsHandler struct {
	eventsService    *services.EventsService
	executionService *executionServices.ExecutionService
}

func NewEventsHandler(eventsService *services.EventsService, executionService *executionServices.ExecutionService) *EventsHandler {
	return &EventsHandler{eventsService: eventsService, executionService: executionService}
}

func (h *EventsHandler) ListTriggers(c *fiber.Ctx) error {
	triggers, err := h.eventsService.ListTriggers(c.Context())
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"triggers": triggers})
}

func (h *EventsHandler) CreateTrigger(c *fiber.Ctx) error {
	var req models.CreateTriggerRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.ID == "" || req.EventType == "" || req.Action == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id, event_type, and action are required"})
	}

	if err := h.eventsService.CreateTrigger(c.Context(), req); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	if runID, err := h.executionService.InsertRun("trigger", req.ID, "create_trigger", req); err == nil {
		_ = h.executionService.CompleteRun(runID, "completed", fiber.Map{"status": "trigger_created"}, nil)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"status": "trigger_created"})
}

func (h *EventsHandler) DeleteTrigger(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "trigger id is required"})
	}

	if err := h.eventsService.DeleteTrigger(c.Context(), id); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	if runID, err := h.executionService.InsertRun("trigger", id, "delete_trigger", fiber.Map{"id": id}); err == nil {
		_ = h.executionService.CompleteRun(runID, "completed", fiber.Map{"status": "trigger_deleted"}, nil)
	}

	return c.JSON(fiber.Map{"status": "trigger_deleted"})
}

func (h *EventsHandler) PublishEvent(c *fiber.Ctx) error {
	var req models.PublishEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.EventType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "event_type is required"})
	}

	if req.Payload == nil {
		req.Payload = map[string]interface{}{}
	}

	if err := h.eventsService.PublishEvent(c.Context(), req); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	if runID, err := h.executionService.InsertRun("event", req.EventType, "publish_event", req); err == nil {
		_ = h.executionService.CompleteRun(runID, "completed", fiber.Map{"status": "event_published"}, nil)
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"status": "event_published"})
}
