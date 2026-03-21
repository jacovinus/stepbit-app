package services

import (
	"os"
	"stepbit-app/internal/session/models"
	"stepbit-app/internal/storage/duckdb"
	"testing"

	"github.com/google/uuid"
)

func BenchmarkSessionService_InsertMessage(b *testing.B) {
	dbPath := "./bench_session.db"
	db, _ := duckdb.NewConnection(dbPath)
	defer db.Close()
	defer os.Remove(dbPath)
	duckdb.InitSchema(db)

	service := NewSessionService(db)
	sessionID := uuid.New()
	service.InsertSession(&models.Session{ID: sessionID, Title: "Bench"})

	msg := &models.Message{
		SessionID: sessionID,
		Role:      "user",
		Content:   "Benchmark message content for performance testing.",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.InsertMessage(msg)
	}
}

func BenchmarkSessionService_ListSessions(b *testing.B) {
	dbPath := "./bench_list.db"
	db, _ := duckdb.NewConnection(dbPath)
	defer db.Close()
	defer os.Remove(dbPath)
	duckdb.InitSchema(db)

	service := NewSessionService(db)
	for i := 0; i < 100; i++ {
		service.InsertSession(&models.Session{ID: uuid.New(), Title: "Session"})
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.ListSessions(50, 0)
	}
}
