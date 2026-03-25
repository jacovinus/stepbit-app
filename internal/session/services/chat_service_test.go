package services

import (
	"os"
	"strings"
	"testing"

	"stepbit-app/internal/chattools"
	"stepbit-app/internal/session/models"
	"stepbit-app/internal/storage/duckdb"

	"github.com/google/uuid"
)

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

func containsAll(input string, fragments ...string) bool {
	for _, fragment := range fragments {
		if !strings.Contains(input, fragment) {
			return false
		}
	}
	return true
}
