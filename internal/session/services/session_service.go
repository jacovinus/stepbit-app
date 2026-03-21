package services

import (
	"database/sql"
	"fmt"
	"os"
	"runtime"
	"stepbit-app/internal/session/models"
	
	"github.com/goccy/go-json"
)

type SessionService struct {
	db *sql.DB
}

func NewSessionService(db *sql.DB) *SessionService {
	return &SessionService{db: db}
}

func (s *SessionService) InsertSession(session *models.Session) error {
	metaJSON, _ := json.Marshal(session.Metadata)
	_, err := s.db.Exec(
		"INSERT INTO sessions (id, title, metadata) VALUES (?, ?, ?)",
		session.ID, session.Title, string(metaJSON),
	)
	return err
}

func (s *SessionService) GetSession(id string) (*models.Session, error) {
	var session models.Session
	var metaStr string
	err := s.db.QueryRow(
		"SELECT id, title, created_at, updated_at, CAST(metadata AS VARCHAR) FROM sessions WHERE id = ?",
		id,
	).Scan(&session.ID, &session.Title, &session.CreatedAt, &session.UpdatedAt, &metaStr)
	
	if err != nil {
		return nil, err
	}
	
	json.Unmarshal([]byte(metaStr), &session.Metadata)
	return &session, nil
}

func (s *SessionService) ListSessions(limit, offset int) ([]models.Session, error) {
	rows, err := s.db.Query(
		"SELECT id, title, created_at, updated_at, CAST(metadata AS VARCHAR) FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?",
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := []models.Session{}
	for rows.Next() {
		var sess models.Session
		var metaStr string
		err := rows.Scan(&sess.ID, &sess.Title, &sess.CreatedAt, &sess.UpdatedAt, &metaStr)
		if err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(metaStr), &sess.Metadata)
		sessions = append(sessions, sess)
	}
	return sessions, nil
}

func (s *SessionService) UpdateSession(id string, title *string, metadata map[string]interface{}) (*models.Session, error) {
	if title != nil {
		_, err := s.db.Exec("UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", *title, id)
		if err != nil {
			return nil, err
		}
	}
	if metadata != nil {
		metaJSON, _ := json.Marshal(metadata)
		_, err := s.db.Exec("UPDATE sessions SET metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", string(metaJSON), id)
		if err != nil {
			return nil, err
		}
	}
	return s.GetSession(id)
}

func (s *SessionService) DeleteSession(id string) error {
	_, err := s.db.Exec("DELETE FROM messages WHERE session_id = ?", id)
	if err != nil {
		return err
	}
	_, err = s.db.Exec("DELETE FROM sessions WHERE id = ?", id)
	return err
}

func (s *SessionService) InsertMessage(msg *models.Message) error {
	metaJSON, _ := json.Marshal(msg.Metadata)
	_, err := s.db.Exec(
		"INSERT INTO messages (session_id, role, content, model, token_count, metadata) VALUES (?, ?, ?, ?, ?, ?)",
		msg.SessionID, msg.Role, msg.Content, msg.Model, msg.TokenCount, string(metaJSON),
	)
	if err != nil {
		return err
	}

	// Update session updated_at
	_, err = s.db.Exec("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", msg.SessionID)
	return err
}

func (s *SessionService) GetMessages(sessionID string, limit, offset int) ([]models.Message, error) {
	rows, err := s.db.Query(
		"SELECT id, session_id, role, content, model, token_count, created_at, CAST(metadata AS VARCHAR) FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
		sessionID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := []models.Message{}
	for rows.Next() {
		var m models.Message
		var metaStr string
		err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.Model, &m.TokenCount, &m.CreatedAt, &metaStr)
		if err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(metaStr), &m.Metadata)
		messages = append(messages, m)
	}
	return messages, nil
}

func (s *SessionService) PurgeSessions() error {
	_, err := s.db.Exec(`
		DELETE FROM messages;
		DELETE FROM tool_results;
		DELETE FROM sessions;
	`)
	return err
}

func (s *SessionService) GetStats(dbPath string) (map[string]interface{}, error) {
	var totalSessions, totalMessages int64
	var totalTokens int64

	// Use COALESCE to handle NULL results from SUM/COUNT when table is empty
	err := s.db.QueryRow("SELECT COUNT(*) FROM sessions").Scan(&totalSessions)
	if err != nil {
		return nil, fmt.Errorf("failed to count sessions: %w", err)
	}

	err = s.db.QueryRow("SELECT COALESCE(SUM(token_count), 0) FROM messages").Scan(&totalTokens)
	if err != nil {
		// Fallback for older schema if token_count doesn't exist yet
		s.db.QueryRow("SELECT COALESCE(SUM(tokens), 0) FROM messages").Scan(&totalTokens)
	}

	err = s.db.QueryRow("SELECT COUNT(*) FROM messages").Scan(&totalMessages)
	if err != nil {
		return nil, fmt.Errorf("failed to count messages: %w", err)
	}

	dbSize := int64(0)
	if dbPath != "" {
		if info, err := os.Stat(dbPath); err == nil {
			dbSize = info.Size()
		}
	}

	// Real Memory Stats
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Model Usage Statistics
	modelUsage := []map[string]interface{}{}
	rows, err := s.db.Query("SELECT COALESCE(model, 'unknown'), SUM(token_count) FROM messages GROUP BY model")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var model string
			var tokens int64
			if err := rows.Scan(&model, &tokens); err == nil {
				modelUsage = append(modelUsage, map[string]interface{}{
					"model": model,
					"tokens": tokens,
				})
			}
		}
	}

	return map[string]interface{}{
		"total_sessions": totalSessions,
		"total_messages": totalMessages,
		"total_tokens":   totalTokens,
		"db_size_bytes":  dbSize,
		"memory_usage": []map[string]interface{}{
			{"tag": "heap_allocated", "usage_bytes": m.Alloc},
			{"tag": "heap_idle", "usage_bytes": m.HeapIdle},
			{"tag": "stack_inuse", "usage_bytes": m.StackInuse},
			{"tag": "duckdb_storage", "usage_bytes": uint64(dbSize)},
		},
		"model_usage": modelUsage,
	}, nil
}
