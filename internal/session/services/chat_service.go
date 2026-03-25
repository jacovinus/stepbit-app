package services

import (
	"context"
	"log"
	"stepbit-app/internal/chattools"
	configModels "stepbit-app/internal/config/models"
	"stepbit-app/internal/config/services"
	"stepbit-app/internal/core"
	"stepbit-app/internal/session/models"
	"strings"

	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

type ChatService struct {
	coreClient     streamingChatClient
	sessionService *SessionService
	configService  *services.ConfigService
	config         *configModels.AppConfig
	toolRegistry   *chattools.Registry
}

func NewChatService(coreClient streamingChatClient, sessionService *SessionService, configService *services.ConfigService, config *configModels.AppConfig) *ChatService {
	return &ChatService{
		coreClient:     coreClient,
		sessionService: sessionService,
		configService:  configService,
		config:         config,
		toolRegistry:   chattools.NewRegistry(),
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
	llmMsgs := make([]core.Message, 0, len(history)+1)
	for _, h := range history {
		llmMsgs = append(llmMsgs, core.Message{
			Role:    h.Role,
			Content: h.Content,
		})
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

	toolDefinitions := s.toolRegistry.DefinitionsWithoutWebTools(search)
	if len(toolDefinitions) > 0 {
		llmMsgs = append([]core.Message{{
			Role:    "system",
			Content: buildToolSystemPrompt(search, reason, toolDefinitions),
		}}, llmMsgs...)
	}

	const maxLoops = 5
	store := toolResultStoreAdapter{service: s.sessionService}

	for loop := 0; loop < maxLoops; loop++ {
		go func(messages []core.Message) {
			log.Printf("[WS-Chat] Calling ChatStreamingWithToolCalls (provider=%s) with %d messages, model=%s", providerID, len(messages), activeModel)

			options := core.ChatOptions{
				Model:  activeModel,
				Search: search,
				Reason: reason,
			}
			if providerID == "ollama" {
				options.BaseURL = strings.TrimSuffix(s.config.Providers.Ollama.URL, "/")
			}

			_, err := s.coreClient.ChatStreamingWithToolCalls(ctx, messages, options, tokenChan)
			errChan <- err
			close(tokenChan)
		}(append([]core.Message(nil), llmMsgs...))

		var turnContent strings.Builder
		for streamMsg := range tokenChan {
			switch streamMsg.Type {
			case "thinking":
				c.WriteJSON(models.WsServerMessage{Type: "status", Content: streamMsg.Content})
			case "trace":
				c.WriteJSON(models.WsServerMessage{Type: "trace", Content: streamMsg.Content})
			case "status":
				c.WriteJSON(models.WsServerMessage{Type: "status", Content: streamMsg.Content})
			case "chunk":
				turnContent.WriteString(streamMsg.Content)
				c.WriteJSON(models.WsServerMessage{Type: "chunk", Content: streamMsg.Content})
			default:
				if streamMsg.Content != "" {
					turnContent.WriteString(streamMsg.Content)
					c.WriteJSON(models.WsServerMessage{Type: "chunk", Content: streamMsg.Content})
				}
			}
		}

		err := <-errChan
		if err != nil {
			log.Printf("[WS-Chat] ChatStreaming error: %v", err)
			if ctx.Err() == nil {
				c.WriteJSON(models.WsServerMessage{Type: "error", Content: err.Error()})
			}
			return
		}

		rawTurnContent := turnContent.String()
		cleanTurnContent := rawTurnContent
		toolCalls, strippedContent, ok := core.ExtractStreamingToolCalls(rawTurnContent)
		if ok {
			cleanTurnContent = strippedContent
		}

		assistantMetadata := make(map[string]interface{})
		if ok {
			assistantMetadata["tool_calls"] = toolCalls
		}

		s.sessionService.InsertMessage(&models.Message{
			SessionID: sessionID,
			Role:      "assistant",
			Content:   cleanTurnContent,
			Metadata:  assistantMetadata,
		})

		llmMsgs = append(llmMsgs, core.Message{
			Role:    "assistant",
			Content: cleanTurnContent,
		})

		if !ok || len(toolCalls) == 0 {
			c.WriteJSON(models.WsServerMessage{Type: "done", Content: ""})
			return
		}

		for _, toolCall := range toolCalls {
			c.WriteJSON(models.WsServerMessage{Type: "status", Content: "Running tool: " + toolCall.Function.Name + "..."})

			result, callErr := s.toolRegistry.CallTool(ctx, toolCall, sessionID, store)
			if callErr != nil {
				result = "Tool error: " + callErr.Error()
			}

			toolCallID := uuid.NewString()
			if toolCall.ID != nil && *toolCall.ID != "" {
				toolCallID = *toolCall.ID
			}

			s.sessionService.InsertMessage(&models.Message{
				SessionID: sessionID,
				Role:      "tool",
				Content:   result,
				Metadata: map[string]interface{}{
					"tool_call_id": toolCallID,
					"tool_name":    toolCall.Function.Name,
				},
			})

			llmMsgs = append(llmMsgs, core.Message{
				Role:    "tool",
				Content: result,
			})
		}

		tokenChan = make(chan core.StreamMessage, 100)
		errChan = make(chan error, 1)
	}

	c.WriteJSON(models.WsServerMessage{Type: "error", Content: "Maximum tool-call loops reached"})
}
