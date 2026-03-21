package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"stepbit-app/internal/storage/duckdb"
	"strings"
	sessionModels "stepbit-app/internal/session/models"
	skillModels "stepbit-app/internal/skill/models"
	pipelineModels "stepbit-app/internal/pipeline/models"

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

// ─── Skill Repository (Migration needed) ────────────────────────────────────

func (s *DbService) PreloadSkillsFromDir(dir string) error {
	files, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil 
		}
		return err
	}

	for _, f := range files {
		if f.IsDir() || filepath.Ext(f.Name()) != ".md" {
			continue
		}
		
		path := filepath.Join(dir, f.Name())
		content, err := os.ReadFile(path)
		if err != nil {
			log.Printf("Error reading skill file %s: %v", path, err)
			continue
		}

		name := strings.TrimSuffix(f.Name(), ".md")
		skill := &skillModels.Skill{
			Name:    name,
			Content: string(content),
			Tags:    "default",
		}
		
		// Check if exists
		var exists bool
		s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM skills WHERE name = ?)", name).Scan(&exists)
		if !exists {
			s.db.Exec("INSERT INTO skills (name, content, tags) VALUES (?, ?, ?)", 
				skill.Name, skill.Content, skill.Tags)
			log.Printf("Preloaded skill: %s", name)
		}
	}
	return nil
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
	_, err := s.db.Exec("DELETE FROM sessions WHERE id = ?", id)
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

func (s *DbService) GetStats() (map[string]interface{}, error) {
	var sessionCount, messageCount int
	s.db.QueryRow("SELECT COUNT(*) FROM sessions").Scan(&sessionCount)
	s.db.QueryRow("SELECT COUNT(*) FROM messages").Scan(&messageCount)

	return map[string]interface{}{
		"total_sessions": sessionCount,
		"total_messages": messageCount,
	}, nil
}

func (s *DbService) PurgeSessions() error {
	_, err := s.db.Exec("DELETE FROM messages")
	if err != nil {
		return err
	}
	_, err = s.db.Exec("DELETE FROM sessions")
	return err
}

func (s *DbService) ListPipelines(limit, offset int) ([]pipelineModels.Pipeline, error) {
	rows, err := s.db.Query("SELECT id, name, definition, created_at, updated_at FROM pipelines LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pipelines []pipelineModels.Pipeline
	for rows.Next() {
		var p pipelineModels.Pipeline
		if err := rows.Scan(&p.ID, &p.Name, &p.Definition, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		pipelines = append(pipelines, p)
	}
	return pipelines, nil
}

func (s *DbService) InsertPipeline(p *pipelineModels.Pipeline) (int64, error) {
	res, err := s.db.Exec("INSERT INTO pipelines (name, definition) VALUES (?, ?)", p.Name, p.Definition)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *DbService) GetPipeline(id int64) (*pipelineModels.Pipeline, error) {
	var p pipelineModels.Pipeline
	err := s.db.QueryRow("SELECT id, name, definition, created_at, updated_at FROM pipelines WHERE id = ?", id).
		Scan(&p.ID, &p.Name, &p.Definition, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *DbService) UpdatePipeline(id int64, p *pipelineModels.Pipeline) error {
	_, err := s.db.Exec("UPDATE pipelines SET name = ?, definition = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", p.Name, p.Definition, id)
	return err
}

func (s *DbService) DeletePipeline(id int64) error {
	_, err := s.db.Exec("DELETE FROM pipelines WHERE id = ?", id)
	return err
}

func (s *DbService) QueryRaw(query string) (*sql.Rows, error) {
	return s.db.Query(query)
}

func (s *DbService) CreateSnapshot(path string) error {
	_, err := s.db.Exec(fmt.Sprintf("CHECKPOINT; COPY FROM (SELECT *) TO '%s' (FORMAT 'PARQUET')", path))
	return err
}
