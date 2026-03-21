package handlers

import (
	"fmt"
	"os"
	"stepbit-app/internal/session/models"
	"stepbit-app/internal/session/services"
	commonModels "stepbit-app/internal/models"
	
	"github.com/google/uuid"
	"github.com/gofiber/fiber/v2"
)

type SessionHandler struct {
	sessionService *services.SessionService
}

func NewSessionHandler(sessionService *services.SessionService) *SessionHandler {
	return &SessionHandler{sessionService: sessionService}
}

func (h *SessionHandler) ListSessions(c *fiber.Ctx) error {
	var query commonModels.PaginationQuery
	if err := c.QueryParser(&query); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid query parameters"})
	}

	if query.Limit == 0 {
		query.Limit = 50
	}

	sessions, err := h.sessionService.ListSessions(query.Limit, query.Offset)
	if err != nil {
		fmt.Printf("[ListSessions Error] %v\n", err)
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to list sessions",
			"details": err.Error(),
		})
	}

	return c.JSON(sessions)
}

func (h *SessionHandler) CreateSession(c *fiber.Ctx) error {
	var req models.CreateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	session := &models.Session{
		ID:       uuid.New(),
		Title:    req.Title,
		Metadata: req.Metadata,
	}

	if session.Metadata == nil {
		session.Metadata = make(map[string]interface{})
	}

	if err := h.sessionService.InsertSession(session); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(session)
}

func (h *SessionHandler) GetSession(c *fiber.Ctx) error {
	id := c.Params("id")
	session, err := h.sessionService.GetSession(id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Session not found"})
	}

	// Fetch messages too? 
	// Original router.go handleGetSession only returns session metadata.
	return c.JSON(session)
}

func (h *SessionHandler) UpdateSession(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.UpdateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	session, err := h.sessionService.UpdateSession(id, req.Title, req.Metadata)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(session)
}

func (h *SessionHandler) DeleteSession(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.sessionService.DeleteSession(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *SessionHandler) GetMessages(c *fiber.Ctx) error {
	id := c.Params("id")
	var query commonModels.PaginationQuery
	if err := c.QueryParser(&query); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid query parameters"})
	}

	if query.Limit == 0 {
		query.Limit = 100
	}

	messages, err := h.sessionService.GetMessages(id, query.Limit, query.Offset)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(messages)
}

func (h *SessionHandler) ExportSession(c *fiber.Ctx) error {
	id := c.Params("id")
	session, err := h.sessionService.GetSession(id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Session not found"})
	}

	messages, err := h.sessionService.GetMessages(id, 1000, 0)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not fetch messages"})
	}

	exportData := struct {
		Session  *models.Session  `json:"session"`
		Messages []models.Message `json:"messages"`
	}{
		Session:  session,
		Messages: messages,
	}

	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=session-%s.json", id))
	return c.JSON(exportData)
}

func (h *SessionHandler) ImportSession(c *fiber.Ctx) error {
	var importData struct {
		Session  models.Session   `json:"session"`
		Messages []models.Message `json:"messages"`
	}

	if err := c.BodyParser(&importData); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid import data"})
	}

	// 1. Create session
	if err := h.sessionService.InsertSession(&importData.Session); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Failed to import session: %v", err)})
	}

	// 2. Import messages
	for _, msg := range importData.Messages {
		if err := h.sessionService.InsertMessage(&msg); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Failed to import message: %v", err)})
		}
	}

	return c.Status(201).JSON(importData.Session)
}

func (h *SessionHandler) PurgeChat(c *fiber.Ctx) error {
	if err := h.sessionService.PurgeSessions(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "ok", "message": "All chat history purged"})
}

func (h *SessionHandler) GetStats(c *fiber.Ctx) error {
	// Attempt to get DB path from env, fallback to common default
	dbPath := os.Getenv("STEPBIT_DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./chat.db"
	}
	
	stats, err := h.sessionService.GetStats(dbPath)
	if err != nil {
		fmt.Printf("[Stats Error] %v\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch system stats",
			"details": err.Error(),
		})
	}
	return c.JSON(stats)
}
