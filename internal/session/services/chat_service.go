package services

import (
	"context"
	"errors"
	"log"
	"stepbit-app/internal/chattools"
	configModels "stepbit-app/internal/config/models"
	"stepbit-app/internal/config/services"
	"stepbit-app/internal/core"
	"stepbit-app/internal/session/models"
	skillServices "stepbit-app/internal/skill/services"
	"strings"
	"time"

	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

type ChatService struct {
	coreClient     streamingChatClient
	sessionService *SessionService
	skillService   *skillServices.SkillService
	configService  *services.ConfigService
	config         *configModels.AppConfig
	toolRegistry   *chattools.Registry
	activeRuns     *activeRunRegistry
}

func NewChatService(coreClient streamingChatClient, sessionService *SessionService, skillService *skillServices.SkillService, configService *services.ConfigService, config *configModels.AppConfig) *ChatService {
	return &ChatService{
		coreClient:     coreClient,
		sessionService: sessionService,
		skillService:   skillService,
		configService:  configService,
		config:         config,
		toolRegistry:   chattools.NewRegistry(),
		activeRuns:     newActiveRunRegistry(),
	}
}

func (s *ChatService) StartWsChatMessage(parentCtx context.Context, write wsWriteFunc, sessionID uuid.UUID, msg models.WsClientMessage) {
	ctx, cancel := context.WithCancel(parentCtx)
	run := &activeChatRun{
		cancel: cancel,
		done:   make(chan struct{}),
	}

	if previous := s.activeRuns.set(sessionID.String(), run); previous != nil {
		previous.cancel()
		select {
		case <-previous.done:
		case <-time.After(2 * time.Second):
		}
	}

	go func() {
		defer close(run.done)
		defer s.activeRuns.clear(sessionID.String(), run)
		s.handleWsChatMessage(ctx, write, sessionID, msg)
	}()
}

func (s *ChatService) CancelActiveRun(ctx context.Context, sessionID uuid.UUID) bool {
	run := s.activeRuns.remove(sessionID.String())
	if run == nil {
		return false
	}

	run.cancel()
	if err := s.coreClient.CancelChat(ctx, sessionID.String()); err != nil {
		log.Printf("[WS-Chat] CancelChat upstream request failed for session=%s: %v", sessionID, err)
	}

	select {
	case <-run.done:
	case <-time.After(3 * time.Second):
		log.Printf("[WS-Chat] Timed out waiting for session=%s to cancel", sessionID)
	}

	return true
}

func (s *ChatService) HandleWsChatMessage(ctx context.Context, c *websocket.Conn, sessionID uuid.UUID, msg models.WsClientMessage) {
	s.handleWsChatMessage(ctx, func(message models.WsServerMessage) {
		_ = c.WriteJSON(message)
	}, sessionID, msg)
}

func (s *ChatService) handleWsChatMessage(ctx context.Context, write wsWriteFunc, sessionID uuid.UUID, msg models.WsClientMessage) {
	log.Printf("[WS-Chat] Starting chat for session=%s content='%s'", sessionID, msg.Content)
	// 1. Initial Status
	write(models.WsServerMessage{Type: "status", Content: "Thinking..."})

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

	if skillPrompt := s.buildSelectedSkillsPrompt(msg.SkillIDs); skillPrompt != "" {
		llmMsgs = append([]core.Message{{
			Role:    "system",
			Content: skillPrompt,
		}}, llmMsgs...)
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

	const maxLoops = 5
	store := toolResultStoreAdapter{service: s.sessionService}

	for loop := 0; loop < maxLoops; loop++ {
		tokenChan = make(chan core.StreamMessage, 100)
		errChan = make(chan error, 1)

		go func(messages []core.Message) {
			options := core.ChatOptions{
				Model:  activeModel,
				Search: search,
				Reason: reason,
			}
			if providerID == "ollama" {
				options.BaseURL = strings.TrimSuffix(s.config.Providers.Ollama.URL, "/")
			}

			log.Printf("[WS-Chat] Calling structured chat stream (provider=%s) with %d messages, model=%s", providerID, len(messages), activeModel)
			result, err := s.coreClient.ChatStreamingStructured(ctx, messages, options, tokenChan)
			if errors.Is(err, core.ErrStructuredResponsesUnavailable) {
				toolDefinitions := s.toolRegistry.DefinitionsWithoutWebTools(search)
				legacyMessages := append([]core.Message(nil), messages...)
				if len(toolDefinitions) > 0 {
					legacyMessages = append([]core.Message{{
						Role:    "system",
						Content: buildToolSystemPrompt(search, reason, toolDefinitions),
					}}, legacyMessages...)
				}

				log.Printf("[WS-Chat] Structured stream unavailable; falling back to legacy tool-call parsing")
				result, err = s.coreClient.ChatStreamingWithToolCalls(ctx, legacyMessages, options, tokenChan)
			} else if err == nil && result.Structured {
				errChan <- structuredChatResultError{result: result}
				close(tokenChan)
				return
			}

			errChan <- err
			close(tokenChan)
		}(append([]core.Message(nil), llmMsgs...))

		var turnContent strings.Builder
		for streamMsg := range tokenChan {
			switch streamMsg.Type {
			case "thinking":
				write(models.WsServerMessage{Type: "status", Content: streamMsg.Content})
			case "trace":
				write(models.WsServerMessage{Type: "trace", Content: streamMsg.Content})
			case "status":
				write(models.WsServerMessage{Type: "status", Content: streamMsg.Content})
			case "chunk":
				turnContent.WriteString(streamMsg.Content)
				write(models.WsServerMessage{Type: "chunk", Content: streamMsg.Content})
			default:
				if streamMsg.Content != "" {
					turnContent.WriteString(streamMsg.Content)
					write(models.WsServerMessage{Type: "chunk", Content: streamMsg.Content})
				}
			}
		}

		err := <-errChan
		rawTurnContent := turnContent.String()
		var structuredResult structuredChatResultError
		if errors.As(err, &structuredResult) {
			assistantMetadata := structuredAssistantMetadata(structuredResult.result)
			s.sessionService.InsertMessage(&models.Message{
				SessionID: sessionID,
				Role:      "assistant",
				Content:   rawTurnContent,
				Metadata:  assistantMetadata,
			})

			llmMsgs = append(llmMsgs, core.Message{
				Role:    "assistant",
				Content: rawTurnContent,
			})

			write(models.WsServerMessage{Type: "context", Content: "", Metadata: assistantMetadata})
			write(models.WsServerMessage{Type: "done", Content: ""})
			return
		}
		if err != nil {
			log.Printf("[WS-Chat] ChatStreaming error: %v", err)
			if ctx.Err() == nil {
				write(models.WsServerMessage{Type: "error", Content: err.Error()})
			}
			return
		}

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
			write(models.WsServerMessage{Type: "done", Content: ""})
			return
		}

		for _, toolCall := range toolCalls {
			write(models.WsServerMessage{Type: "status", Content: "Running tool: " + toolCall.Function.Name + "..."})

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

	}

	write(models.WsServerMessage{Type: "error", Content: "Maximum tool-call loops reached"})
}

func (s *ChatService) buildSelectedSkillsPrompt(skillIDs []int64) string {
	if len(skillIDs) == 0 || s.skillService == nil {
		return ""
	}

	skills, err := s.skillService.GetSkillsByIDs(skillIDs)
	if err != nil || len(skills) == 0 {
		if err != nil {
			log.Printf("[WS-Chat] Failed to load selected skills: %v", err)
		}
		return ""
	}

	return buildSkillPolicyPrompt(skills)
}
