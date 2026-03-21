package services

import (
	"context"
	"log"
	"strings"
	configModels "stepbit-app/internal/config/models"
	"stepbit-app/internal/config/services"
	"stepbit-app/internal/core"
	"stepbit-app/internal/session/models"
	
	"github.com/google/uuid"
	"github.com/gofiber/websocket/v2"
)

type ChatService struct {
	coreClient     *core.StepbitCoreClient
	sessionService *SessionService
	configService  *services.ConfigService
	config         *configModels.AppConfig
}

func NewChatService(coreClient *core.StepbitCoreClient, sessionService *SessionService, configService *services.ConfigService, config *configModels.AppConfig) *ChatService {
	return &ChatService{
		coreClient:     coreClient,
		sessionService: sessionService,
		configService:  configService,
		config:         config,
	}
}

func (s *ChatService) HandleWsChatMessage(ctx context.Context, c *websocket.Conn, sessionID uuid.UUID, msg models.WsClientMessage) {
	log.Printf("[WS-Chat] Starting chat for session=%s content='%s'", sessionID, msg.Content)
	// 1. Initial Status
	c.WriteJSON(models.WsServerMessage{Type: "status", Content: "Thinking..."})

	// 2. Persist User Message
	s.sessionService.InsertMessage(&models.Message{
		SessionID: sessionID,
		Role:      "user",
		Content:   msg.Content,
		Metadata:  make(map[string]interface{}),
	})

	// 3. Fetch History for Context
	history, _ := s.sessionService.GetMessages(sessionID.String(), 50, 0)
	llmMsgs := make([]core.Message, len(history))
	for i, h := range history {
		llmMsgs[i] = core.Message{
			Role:    h.Role,
			Content: h.Content,
		}
	}

	// 4. Call Core for Streaming
	tokenChan := make(chan core.StreamMessage, 100)
	errChan := make(chan error, 1)

	search := false
	if msg.Search != nil {
		search = *msg.Search
	}
	reason := false
	if msg.Reason != nil {
		reason = *msg.Reason
	}

	activeModel := s.configService.GetActiveModel()
	activeProvider, _ := s.configService.GetActiveProvider(ctx)
	providerID := activeProvider["id"].(string)

	go func() {
		log.Printf("[WS-Chat] Calling ChatStreaming (provider=%s) with %d messages, model=%s", providerID, len(llmMsgs), activeModel)
		
		options := core.ChatOptions{
			Model:  activeModel,
			Search: search,
			Reason: reason,
		}
		if providerID == "ollama" {
			options.BaseURL = strings.TrimSuffix(s.config.Providers.Ollama.URL, "/")
		}

		errChan <- s.coreClient.ChatStreaming(ctx, llmMsgs, options, tokenChan)
		close(tokenChan)
	}()

	var fullContent strings.Builder
	for msg := range tokenChan {
		if msg.Type == "thinking" {
			c.WriteJSON(models.WsServerMessage{Type: "status", Content: msg.Content})
			continue
		}
		
		fullContent.WriteString(msg.Content)
		c.WriteJSON(models.WsServerMessage{Type: "chunk", Content: msg.Content})
	}

	if err := <-errChan; err != nil {
		log.Printf("[WS-Chat] ChatStreaming error: %v", err)
		if ctx.Err() == nil { // Not cancelled
			c.WriteJSON(models.WsServerMessage{Type: "error", Content: err.Error()})
		}
	} else {
		log.Printf("[WS-Chat] Streaming complete, content length=%d", fullContent.Len())
		s.sessionService.InsertMessage(&models.Message{
			SessionID: sessionID,
			Role:      "assistant",
			Content:   fullContent.String(),
			Metadata:  make(map[string]interface{}),
		})
		c.WriteJSON(models.WsServerMessage{Type: "done", Content: ""})
	}
}
