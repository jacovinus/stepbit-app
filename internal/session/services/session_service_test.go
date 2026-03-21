package services

import (
	"os"
	"stepbit-app/internal/session/models"
	"stepbit-app/internal/storage/duckdb"
	"testing"

	"github.com/google/uuid"
)

func ptrInt32(v int32) *int32 { return &v }
func ptrString(v string) *string { return &v }

func TestSessionService_CRUD(t *testing.T) {
	dbPath := "./test_session.db"
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

	// 1. Insert Session
	sessionID := uuid.New()
	session := &models.Session{
		ID:    sessionID,
		Title: "Test Session",
		Metadata: map[string]interface{}{
			"test": true,
		},
	}

	if err := service.InsertSession(session); err != nil {
		t.Fatalf("InsertSession failed: %v", err)
	}

	// 2. Get Session
	got, err := service.GetSession(sessionID.String())
	if err != nil {
		t.Fatalf("GetSession failed: %v", err)
	}
	if got.Title != "Test Session" {
		t.Errorf("Expected title 'Test Session', got '%s'", got.Title)
	}

	// 3. Update Session
	newTitle := "Updated Title"
	updated, err := service.UpdateSession(sessionID.String(), &newTitle, nil)
	if err != nil {
		t.Fatalf("UpdateSession failed: %v", err)
	}
	if updated.Title != newTitle {
		t.Errorf("Expected updated title '%s', got '%s'", newTitle, updated.Title)
	}

	// 4. List Sessions
	sessions, err := service.ListSessions(10, 0)
	if err != nil {
		t.Fatalf("ListSessions failed: %v", err)
	}
	if len(sessions) != 1 {
		t.Errorf("Expected 1 session, got %d", len(sessions))
	}

	// 5. Delete Session
	if err := service.DeleteSession(sessionID.String()); err != nil {
		t.Fatalf("DeleteSession failed: %v", err)
	}
	_, err = service.GetSession(sessionID.String())
	if err == nil {
		t.Error("Expected error for deleted session, got nil")
	}
}

func TestSessionService_Messages(t *testing.T) {
	dbPath := "./test_messages.db"
	defer os.Remove(dbPath)

	db, err := duckdb.NewConnection(dbPath)
	if err != nil {
		t.Fatalf("Failed to connect to duckdb: %v", err)
	}
	defer db.Close()
	duckdb.InitSchema(db)

	service := NewSessionService(db)
	sessionID := uuid.New()
	service.InsertSession(&models.Session{ID: sessionID, Title: "Chat Session"})

	// 1. Insert Message
	msg := &models.Message{
		SessionID:  sessionID,
		Role:       "user",
		Content:    "Hello",
		TokenCount: ptrInt32(10),
	}
	if err := service.InsertMessage(msg); err != nil {
		t.Fatalf("InsertMessage failed: %v", err)
	}

	// 2. Get Messages
	messages, err := service.GetMessages(sessionID.String(), 10, 0)
	if err != nil {
		t.Fatalf("GetMessages failed: %v", err)
	}
	if len(messages) != 1 {
		t.Errorf("Expected 1 message, got %d", len(messages))
	}
	if messages[0].Content != "Hello" {
		t.Errorf("Expected content 'Hello', got '%s'", messages[0].Content)
	}

	// 3. Stats
	stats, err := service.GetStats(dbPath)
	if err != nil {
		t.Fatalf("GetStats failed: %v", err)
	}
	if stats["total_messages"].(int64) != 1 {
		t.Errorf("Expected 1 total message in stats, got %v", stats["total_messages"])
	}
}
