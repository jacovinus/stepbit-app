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
	"stepbit-app/internal/storage/duckdb"

	"github.com/google/uuid"
)

type fakeStreamingChatClient struct {
	cancelledSessions []string
	mu                sync.Mutex
	blockOnStream     bool
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
	if !containsAll(prompt, "Reason step-by-step", "internet_search", "Search the web.") {
		t.Fatalf("prompt missing expected instructions: %s", prompt)
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

	chatService := NewChatService(client, sessionService, configService, &configModels.AppConfig{})
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

func containsAll(input string, fragments ...string) bool {
	for _, fragment := range fragments {
		if !strings.Contains(input, fragment) {
			return false
		}
	}
	return true
}
