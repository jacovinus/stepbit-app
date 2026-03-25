package handlers

import (
	"context"
	"log"
	"stepbit-app/internal/session/models"
	"stepbit-app/internal/session/services"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

type ChatHandler struct {
	chatService *services.ChatService
}

func NewChatHandler(chatService *services.ChatService) *ChatHandler {
	return &ChatHandler{chatService: chatService}
}

func (h *ChatHandler) HandleWebSocket(c *websocket.Conn) {
	sessionIDStr := c.Params("id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		log.Printf("[WS] Invalid session ID: %v", err)
		c.WriteJSON(models.WsServerMessage{Type: "error", Content: "Invalid session ID"})
		c.Close()
		return
	}

	defer c.Close()
	defer h.chatService.CancelActiveRun(context.Background(), sessionID)
	var writeMu sync.Mutex
	writeJSON := func(message models.WsServerMessage) {
		writeMu.Lock()
		defer writeMu.Unlock()
		_ = c.WriteJSON(message)
	}

	for {
		var msg models.WsClientMessage
		if err := c.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] error: %v", err)
			}
			break
		}

		if msg.Type == "message" {
			h.chatService.StartWsChatMessage(context.Background(), writeJSON, sessionID, msg)
		} else if msg.Type == "cancel" {
			log.Printf("[WS] Cancel request received for session %s", sessionID)
			if h.chatService.CancelActiveRun(context.Background(), sessionID) {
				writeJSON(models.WsServerMessage{Type: "status", Content: "Process cancelled"})
				writeJSON(models.WsServerMessage{Type: "done", Content: ""})
			}
		} else {
			writeJSON(models.WsServerMessage{Type: "error", Content: "Unknown message type: " + msg.Type})
		}
	}
}

// Router adapter for Fiber
func (h *ChatHandler) WebSocketUpgrade() fiber.Handler {
	return websocket.New(h.HandleWebSocket)
}
