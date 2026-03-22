package db

import (
	"database/sql"
	"fmt"
	"stepbit-app/internal/storage/duckdb"
	sessionModels "stepbit-app/internal/session/models"

	_ "github.com/marcboeker/go-duckdb"
)

type DbService struct {
	db *sql.DB
}

func NewDbService(dbPath string) (*DbService, error) {
	db, err := duckdb.NewConnection(dbPath)
	if err != nil {
		return nil, err
	}

	if err := duckdb.InitSchema(db); err != nil {
		return nil, fmt.Errorf("failed to init schema: %w", err)
	}

	return &DbService{db: db}, nil
}

func (s *DbService) GetDB() *sql.DB {
	return s.db
}

func (s *DbService) Close() error {
	return s.db.Close()
}

func (s *DbService) Ping() error {
	return s.db.Ping()
}

// ─── Legacy methods that should be moved to Repositories ──────────────────────

func (s *DbService) InsertSession(sess *sessionModels.Session) error {
	_, err := s.db.Exec("INSERT INTO sessions (id, title) VALUES (?, ?)", sess.ID, sess.Title)
	return err
}

func (s *DbService) GetSession(id string) (*sessionModels.Session, error) {
	var sess sessionModels.Session
	err := s.db.QueryRow("SELECT id, title, created_at, updated_at FROM sessions WHERE id = ?", id).
		Scan(&sess.ID, &sess.Title, &sess.CreatedAt, &sess.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

func (s *DbService) ListSessions(limit, offset int) ([]sessionModels.Session, error) {
	rows, err := s.db.Query("SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []sessionModels.Session
	for rows.Next() {
		var sess sessionModels.Session
		if err := rows.Scan(&sess.ID, &sess.Title, &sess.CreatedAt, &sess.UpdatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, sess)
	}
	return sessions, nil
}

func (s *DbService) UpdateSession(sess *sessionModels.Session) error {
	_, err := s.db.Exec("UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", sess.Title, sess.ID)
	return err
}

func (s *DbService) DeleteSession(id string) error {
	_, err := s.db.Exec("DELETE FROM messages WHERE session_id = ?", id)
	if err != nil {
		return err
	}
	_, err = s.db.Exec("DELETE FROM sessions WHERE id = ?", id)
	return err
}

func (s *DbService) InsertMessage(msg *sessionModels.Message) error {
	_, err := s.db.Exec("INSERT INTO messages (session_id, role, content, model) VALUES (?, ?, ?, ?)",
		msg.SessionID, msg.Role, msg.Content, msg.Model)
	if err != nil {
		return err
	}
	// Update session updated_at
	s.db.Exec("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", msg.SessionID)
	return nil
}

func (s *DbService) GetMessages(sessionID string) ([]sessionModels.Message, error) {
	rows, err := s.db.Query("SELECT id, session_id, role, content, model, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC", sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []sessionModels.Message
	for rows.Next() {
		var msg sessionModels.Message
		if err := rows.Scan(&msg.ID, &msg.SessionID, &msg.Role, &msg.Content, &msg.Model, &msg.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

func (s *DbService) PurgeSessions() error {
	_, err := s.db.Exec("DELETE FROM messages")
	if err != nil {
		return err
	}
	_, err = s.db.Exec("DELETE FROM sessions")
	return err
}

func (s *DbService) QueryRaw(query string) (*sql.Rows, error) {
	return s.db.Query(query)
}

func (s *DbService) CreateSnapshot(path string) error {
	// 1. Ensure all data is flushed
	if _, err := s.db.Exec("CHECKPOINT;"); err != nil {
		return fmt.Errorf("failed to checkpoint before snapshot: %w", err)
	}

	// 2. Export database to target directory
	// In DuckDB, 'path' here should be a directory for EXPORT DATABASE
	// If it's a file, we should use a different approach or ensure it's a dir.
	// We'll use the 'COPY TO' approach for a single file if possible, or EXPORT
	_, err := s.db.Exec(fmt.Sprintf("EXPORT DATABASE '%s' (FORMAT PARQUET);", path))
	return err
}
