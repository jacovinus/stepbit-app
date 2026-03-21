package handlers

import (
	"context"
	"log"
	"stepbit-app/internal/session/models"
	"stepbit-app/internal/session/services"
	
	"github.com/google/uuid"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
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

	for {
		var msg models.WsClientMessage
		if err := c.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] error: %v", err)
			}
			break
		}

		if msg.Type == "message" {
			h.chatService.HandleWsChatMessage(context.Background(), c, sessionID, msg)
		} else if msg.Type == "cancel" {
			// For now, we logging. Real cancellation requires tracking context per session.
			log.Printf("[WS] Cancel request received for session %s", sessionID)
		} else {
			c.WriteJSON(models.WsServerMessage{Type: "error", Content: "Unknown message type: " + msg.Type})
		}
	}
}

// Router adapter for Fiber
func (h *ChatHandler) WebSocketUpgrade() fiber.Handler {
	return websocket.New(h.HandleWebSocket)
}
