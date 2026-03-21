package db

import (
	"os"
	sessionModels "stepbit-app/internal/session/models"
	"testing"

	"github.com/google/uuid"
)

func TestDbService_Integration(t *testing.T) {
	dbPath := "./test_chat.db"
	defer os.Remove(dbPath)

	service, err := NewDbService(dbPath)
	if err != nil {
		t.Fatalf("Failed to create DbService: %v", err)
	}
	defer service.Close()

	// 1. Test Session
	sessionID := uuid.New()
	session := &sessionModels.Session{
		ID:       sessionID,
		Title:    "Test Session",
		Metadata: map[string]interface{}{"foo": "bar"},
	}

	if err := service.InsertSession(session); err != nil {
		t.Fatalf("InsertSession failed: %v", err)
	}

	gotSession, err := service.GetSession(sessionID.String())
	if err != nil {
		t.Fatalf("GetSession failed: %v", err)
	}
	if gotSession.Title != "Test Session" {
		t.Errorf("Expected title 'Test Session', got '%s'", gotSession.Title)
	}

	// 2. Test Message
	msg := &sessionModels.Message{
		SessionID: sessionID,
		Role:      "user",
		Content:   "Hello DuckDB",
		Metadata:  map[string]interface{}{"source": "test"},
	}

	if err := service.InsertMessage(msg); err != nil {
		t.Fatalf("InsertMessage failed: %v", err)
	}

	messages, err := service.GetMessages(sessionID.String())
	if err != nil {
		t.Fatalf("GetMessages failed: %v", err)
	}
	if len(messages) != 1 {
		t.Errorf("Expected 1 message, got %d", len(messages))
	}
	if messages[0].Content != "Hello DuckDB" {
		t.Errorf("Expected content 'Hello DuckDB', got '%s'", messages[0].Content)
	}
}
