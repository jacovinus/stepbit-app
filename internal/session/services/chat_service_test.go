package services

import (
	"context"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"stepbit-app/internal/chattools"
	configModels "stepbit-app/internal/config/models"
	configServices "stepbit-app/internal/config/services"
	"stepbit-app/internal/core"
	"stepbit-app/internal/session/models"
	skillModels "stepbit-app/internal/skill/models"
	"stepbit-app/internal/storage/duckdb"

	"github.com/google/uuid"
)

type fakeStreamingChatClient struct {
	cancelledSessions []string
	mu                sync.Mutex
	blockOnStream     bool
	structuredResult  core.ChatStreamResult
	structuredErr     error
	structuredStream  []core.StreamMessage
}

func (f *fakeStreamingChatClient) ChatStreamingStructured(ctx context.Context, messages []core.Message, options core.ChatOptions, tokenChan chan<- core.StreamMessage) (core.ChatStreamResult, error) {
	_ = messages
	_ = options
	if f.blockOnStream {
		<-ctx.Done()
		return core.ChatStreamResult{}, ctx.Err()
	}
	if f.structuredErr == nil && len(f.structuredStream) == 0 && !f.structuredResult.Structured {
		return core.ChatStreamResult{}, core.ErrStructuredResponsesUnavailable
	}
	for _, message := range f.structuredStream {
		select {
		case tokenChan <- message:
		case <-ctx.Done():
			return core.ChatStreamResult{}, ctx.Err()
		}
	}
	if f.structuredErr != nil {
		return core.ChatStreamResult{}, f.structuredErr
	}
	return f.structuredResult, nil
}

func (f *fakeStreamingChatClient) ChatStreamingWithToolCalls(ctx context.Context, messages []core.Message, options core.ChatOptions, tokenChan chan<- core.StreamMessage) (core.ChatStreamResult, error) {
	_ = messages
	_ = options
	_ = tokenChan
	if f.blockOnStream {
		<-ctx.Done()
		return core.ChatStreamResult{}, ctx.Err()
	}
	return core.ChatStreamResult{}, nil
}

func (f *fakeStreamingChatClient) CancelChat(ctx context.Context, sessionID string) error {
	_ = ctx
	f.mu.Lock()
	defer f.mu.Unlock()
	f.cancelledSessions = append(f.cancelledSessions, sessionID)
	return nil
}

func TestBuildToolSystemPrompt_IncludesDefinitions(t *testing.T) {
	prompt := buildToolSystemPrompt(true, true, []chattools.ToolDefinition{
		{
			Name:        "internet_search",
			Description: "Search the web.",
			Parameters:  `{"type":"object"}`,
		},
	})

	if prompt == "" {
		t.Fatal("expected prompt to be populated")
	}
	if !containsAll(prompt, "Reason step-by-step", "internet_search", "Search the web.", "Do not return JSON Schema fields", "Do not explain the tool call") {
		t.Fatalf("prompt missing expected instructions: %s", prompt)
	}
}

func TestBuildSkillPolicyPrompt_ReducesRawSkillInstructionsToPolicy(t *testing.T) {
	prompt := buildSkillPolicyPrompt([]skillModels.Skill{
		{
			Name: "Web Researcher",
			Content: `---
description: Web Researcher
---

You have access to the internet_search and read_url tools.
Use Tables whenever presenting comparisons.
Cite sources.
Be concise.`,
		},
	})

	if prompt == "" {
		t.Fatal("expected skill policy prompt")
	}
	if !containsAll(prompt, "Web Researcher", "Allowed tools: internet_search, read_url.", "Cite sources", "Use Markdown tables", "Keep the final answer concise") {
		t.Fatalf("policy prompt missing expected guidance: %s", prompt)
	}
	if strings.Contains(prompt, "When you call a tool") {
		t.Fatalf("policy prompt should not include raw procedural skill instructions: %s", prompt)
	}
}

func TestBuildSkillPolicyPrompt_PrefersStructuredSkillPolicy(t *testing.T) {
	prompt := buildSkillPolicyPrompt([]skillModels.Skill{
		{
			Name:    "Web Researcher",
			Content: "Legacy markdown content",
			Policy: &skillModels.SkillPolicy{
				Description:      "Live web research specialist",
				AllowedTools:     []string{"internet_search", "read_url"},
				CitationPolicy:   "required",
				PreferredOutputs: []string{"table", "concise"},
			},
		},
	})

	if !containsAll(prompt, "Live web research specialist", "Allowed tools: internet_search, read_url.", "Cite sources", "Use Markdown tables", "Keep the final answer concise") {
		t.Fatalf("policy prompt missing structured guidance: %s", prompt)
	}
}

func TestSessionService_ToolResults(t *testing.T) {
	dbPath := "./test_tool_results.db"
	defer os.Remove(dbPath)

	db, err := duckdb.NewConnection(dbPath)
	if err != nil {
		t.Fatalf("Failed to connect to duckdb: %v", err)
	}
	defer db.Close()

	if err := duckdb.InitSchema(db); err != nil {
		t.Fatalf("Failed to init schema: %v", err)
	}

	service := NewSessionService(db)
	sessionID := uuid.New()
	if err := service.InsertSession(&models.Session{ID: sessionID, Title: "Tool Session"}); err != nil {
		t.Fatalf("InsertSession failed: %v", err)
	}

	inserted, err := service.InsertToolResult(&models.ToolResult{
		SessionID: sessionID,
		SourceURL: "https://example.com",
		Content:   "content",
	})
	if err != nil {
		t.Fatalf("InsertToolResult failed: %v", err)
	}

	got, err := service.GetToolResult(inserted.ID)
	if err != nil {
		t.Fatalf("GetToolResult failed: %v", err)
	}
	if got.SourceURL != "https://example.com" {
		t.Fatalf("unexpected source url: %s", got.SourceURL)
	}
	if got.Content != "content" {
		t.Fatalf("unexpected content: %s", got.Content)
	}
}

func TestChatService_CancelActiveRun(t *testing.T) {
	dbPath := "./test_chat_cancel.db"
	defer os.Remove(dbPath)

	db, err := duckdb.NewConnection(dbPath)
	if err != nil {
		t.Fatalf("Failed to connect to duckdb: %v", err)
	}
	defer db.Close()

	if err := duckdb.InitSchema(db); err != nil {
		t.Fatalf("Failed to init schema: %v", err)
	}

	sessionService := NewSessionService(db)
	sessionID := uuid.New()
	if err := sessionService.InsertSession(&models.Session{ID: sessionID, Title: "Cancel Session"}); err != nil {
		t.Fatalf("InsertSession failed: %v", err)
	}

	client := &fakeStreamingChatClient{blockOnStream: true}
	configService := configServices.NewConfigService(core.NewStepbitCoreClient("http://localhost:1", "test-key", "model-1"), &configModels.AppConfig{})
	configService.SetActiveModel("model-1")

	chatService := NewChatService(client, sessionService, nil, configService, &configModels.AppConfig{})
	writes := make(chan models.WsServerMessage, 4)

	chatService.StartWsChatMessage(context.Background(), func(message models.WsServerMessage) {
		writes <- message
	}, sessionID, models.WsClientMessage{
		Type:    "message",
		Content: "cancel me",
	})

	time.Sleep(50 * time.Millisecond)

	if !chatService.CancelActiveRun(context.Background(), sessionID) {
		t.Fatal("expected active run to be cancelled")
	}

	client.mu.Lock()
	defer client.mu.Unlock()
	if len(client.cancelledSessions) != 1 || client.cancelledSessions[0] != sessionID.String() {
		t.Fatalf("unexpected cancelled sessions: %#v", client.cancelledSessions)
	}

	if chatService.CancelActiveRun(context.Background(), sessionID) {
		t.Fatal("expected second cancellation to report no active run")
	}
}

func TestChatService_UsesStructuredPathWhenAvailable(t *testing.T) {
	dbPath := "./test_chat_structured.db"
	defer os.Remove(dbPath)

	db, err := duckdb.NewConnection(dbPath)
	if err != nil {
		t.Fatalf("Failed to connect to duckdb: %v", err)
	}
	defer db.Close()

	if err := duckdb.InitSchema(db); err != nil {
		t.Fatalf("Failed to init schema: %v", err)
	}

	sessionService := NewSessionService(db)
	sessionID := uuid.New()
	if err := sessionService.InsertSession(&models.Session{ID: sessionID, Title: "Structured Session"}); err != nil {
		t.Fatalf("InsertSession failed: %v", err)
	}

	client := &fakeStreamingChatClient{
		structuredResult: core.ChatStreamResult{
			Structured: true,
			UsedTools:  true,
			ToolEvents: []string{"internet_search"},
			TurnContext: &core.TurnCapabilityContext{
				SearchEnabled:  true,
				RequestedTools: []string{"internet_search"},
				AvailableTools: []core.TurnCapabilityTool{{
					Name:       "internet_search",
					ProviderID: "web",
					Enabled:    true,
					ReadOnly:   true,
					OpenWorld:  true,
					Tags:       []string{"web"},
				}},
				UsedTools: []string{"internet_search"},
			},
			OutputItems: []core.StructuredOutputItem{
				{
					ID:       "tool-0-citation-0",
					ItemType: "citation",
					Role:     "assistant",
					Status:   "completed",
					Content: []core.StructuredContentItem{{
						ContentType: "citation",
						Text:        "Example Source",
						Citation: &core.StructuredCitation{
							SourceID: "src_1",
							Title:    "Example Source",
							URL:      "https://example.com/story",
						},
					}},
				},
			},
		},
		structuredStream: []core.StreamMessage{
			{Type: "status", Content: "Running tool: internet_search..."},
			{Type: "chunk", Content: "Latest headlines"},
		},
	}
	configService := configServices.NewConfigService(core.NewStepbitCoreClient("http://localhost:1", "test-key", "model-1"), &configModels.AppConfig{})
	configService.SetActiveModel("model-1")

	chatService := NewChatService(client, sessionService, nil, configService, &configModels.AppConfig{})

	var writes []models.WsServerMessage
	chatService.handleWsChatMessage(context.Background(), func(message models.WsServerMessage) {
		writes = append(writes, message)
	}, sessionID, models.WsClientMessage{
		Type:    "message",
		Content: "search current news",
	})

	history, err := sessionService.GetMessages(sessionID.String(), 20, 0)
	if err != nil {
		t.Fatalf("GetMessages failed: %v", err)
	}
	if len(history) < 2 {
		t.Fatalf("expected at least user and assistant messages, got %d", len(history))
	}
	assistant := history[len(history)-1]
	if assistant.Role != "assistant" {
		t.Fatalf("expected assistant message, got %s", assistant.Role)
	}
	if assistant.Content != "Latest headlines" {
		t.Fatalf("unexpected assistant content: %q", assistant.Content)
	}
	if assistant.Metadata["structured"] != true {
		t.Fatalf("expected structured metadata, got %#v", assistant.Metadata)
	}
	if assistant.Metadata["turn_context"] == nil {
		t.Fatalf("expected turn context metadata, got %#v", assistant.Metadata)
	}
	if assistant.Metadata["output_items"] == nil {
		t.Fatalf("expected structured output items metadata, got %#v", assistant.Metadata)
	}

	if !containsMessage(writes, "done", "") {
		t.Fatalf("expected done message in websocket writes: %#v", writes)
	}
	if !containsMessage(writes, "status", "Running tool: internet_search...") {
		t.Fatalf("expected structured tool status in websocket writes: %#v", writes)
	}
	if !containsMessage(writes, "context", "") {
		t.Fatalf("expected context message in websocket writes: %#v", writes)
	}
}

func containsMessage(messages []models.WsServerMessage, msgType, content string) bool {
	for _, message := range messages {
		if message.Type != msgType {
			continue
		}
		if content == "" || message.Content == content {
			return true
		}
	}
	return false
}

func containsAll(input string, fragments ...string) bool {
	for _, fragment := range fragments {
		if !strings.Contains(input, fragment) {
			return false
		}
	}
	return true
}
