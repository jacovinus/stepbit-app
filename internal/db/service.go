package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"stepbit-app/internal/models"
	"strings"

	"github.com/goccy/go-json"
	_ "github.com/marcboeker/go-duckdb"
)

type DbService struct {
	db *sql.DB
}

func NewDbService(path string) (*DbService, error) {
	db, err := sql.Open("duckdb", path)
	if err != nil {
		return nil, err
	}

	if _, err := db.Exec(Schema); err != nil {
		return nil, err
	}

	return &DbService{db: db}, nil
}

func (s *DbService) Close() error {
	return s.db.Close()
}

func (s *DbService) Ping() error {
	return s.db.Ping()
}

// Session Operations

func (s *DbService) InsertSession(session *models.Session) error {
	metaJSON, _ := json.Marshal(session.Metadata)
	_, err := s.db.Exec(
		"INSERT INTO sessions (id, name, metadata) VALUES (?, ?, ?)",
		session.ID, session.Name, string(metaJSON),
	)
	return err
}

func (s *DbService) GetSession(id string) (*models.Session, error) {
	var session models.Session
	var metaStr string
	err := s.db.QueryRow(
		"SELECT id, name, created_at, updated_at, CAST(metadata AS VARCHAR) FROM sessions WHERE id = ?",
		id,
	).Scan(&session.ID, &session.Name, &session.CreatedAt, &session.UpdatedAt, &metaStr)
	
	if err != nil {
		return nil, err
	}
	
	json.Unmarshal([]byte(metaStr), &session.Metadata)
	return &session, nil
}

func (s *DbService) ListSessions(limit, offset int) ([]models.Session, error) {
	rows, err := s.db.Query(
		"SELECT id, name, created_at, updated_at, CAST(metadata AS VARCHAR) FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?",
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
		err := rows.Scan(&sess.ID, &sess.Name, &sess.CreatedAt, &sess.UpdatedAt, &metaStr)
		if err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(metaStr), &sess.Metadata)
		sessions = append(sessions, sess)
	}
	return sessions, nil
}

func (s *DbService) UpdateSession(id string, name *string, metadata map[string]interface{}) (*models.Session, error) {
	if name != nil {
		_, err := s.db.Exec("UPDATE sessions SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", *name, id)
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

func (s *DbService) DeleteSession(id string) error {
	_, err := s.db.Exec("DELETE FROM messages WHERE session_id = ?", id)
	if err != nil {
		return err
	}
	_, err = s.db.Exec("DELETE FROM sessions WHERE id = ?", id)
	return err
}

// Message Operations

func (s *DbService) InsertMessage(msg *models.Message) error {
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

func (s *DbService) GetMessages(sessionID string, limit, offset int) ([]models.Message, error) {
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

// Skill Operations

func (s *DbService) InsertSkill(skill *models.Skill) (int64, error) {
	res, err := s.db.Exec(
		"INSERT INTO skills (name, content, tags, source_url) VALUES (?, ?, ?, ?)",
		skill.Name, skill.Content, skill.Tags, skill.SourceURL,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *DbService) ListSkills(limit, offset int) ([]models.Skill, error) {
	rows, err := s.db.Query("SELECT id, name, content, tags, source_url, created_at, updated_at FROM skills LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	skills := []models.Skill{}
	for rows.Next() {
		var sk models.Skill
		rows.Scan(&sk.ID, &sk.Name, &sk.Content, &sk.Tags, &sk.SourceURL, &sk.CreatedAt, &sk.UpdatedAt)
		skills = append(skills, sk)
	}
	return skills, nil
}

func (s *DbService) GetSkill(id int64) (*models.Skill, error) {
	var sk models.Skill
	err := s.db.QueryRow(
		"SELECT id, name, content, tags, source_url, created_at, updated_at FROM skills WHERE id = ?",
		id,
	).Scan(&sk.ID, &sk.Name, &sk.Content, &sk.Tags, &sk.SourceURL, &sk.CreatedAt, &sk.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &sk, nil
}

func (s *DbService) UpdateSkill(id int64, skill *models.Skill) error {
	_, err := s.db.Exec(
		"UPDATE skills SET name = ?, content = ?, tags = ?, source_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		skill.Name, skill.Content, skill.Tags, skill.SourceURL, id,
	)
	return err
}

func (s *DbService) DeleteSkill(id int64) error {
	_, err := s.db.Exec("DELETE FROM skills WHERE id = ?", id)
	return err
}

// Pipeline Operations

func (s *DbService) InsertPipeline(p *models.Pipeline) (int64, error) {
	defJSON, _ := json.Marshal(p.Definition)
	res, err := s.db.Exec(
		"INSERT INTO pipelines (name, definition) VALUES (?, ?)",
		p.Name, string(defJSON),
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *DbService) ListPipelines(limit, offset int) ([]models.Pipeline, error) {
	rows, err := s.db.Query("SELECT id, name, CAST(definition AS VARCHAR), created_at, updated_at FROM pipelines LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pipelines := []models.Pipeline{}
	for rows.Next() {
		var p models.Pipeline
		var defStr string
		rows.Scan(&p.ID, &p.Name, &defStr, &p.CreatedAt, &p.UpdatedAt)
		json.Unmarshal([]byte(defStr), &p.Definition)
		pipelines = append(pipelines, p)
	}
	return pipelines, nil
}

func (s *DbService) GetPipeline(id int64) (*models.Pipeline, error) {
	var p models.Pipeline
	var defStr string
	err := s.db.QueryRow(
		"SELECT id, name, CAST(definition AS VARCHAR), created_at, updated_at FROM pipelines WHERE id = ?",
		id,
	).Scan(&p.ID, &p.Name, &defStr, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(defStr), &p.Definition)
	return &p, nil
}

func (s *DbService) UpdatePipeline(id int64, p *models.Pipeline) error {
	defJSON, _ := json.Marshal(p.Definition)
	_, err := s.db.Exec(
		"UPDATE pipelines SET name = ?, definition = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		p.Name, string(defJSON), id,
	)
	return err
}

func (s *DbService) DeletePipeline(id int64) error {
	_, err := s.db.Exec("DELETE FROM pipelines WHERE id = ?", id)
	return err
}

// Stats and Maintenance

func (s *DbService) GetStats() (map[string]interface{}, error) {
	var totalSessions, totalMessages, totalTokens int64
	s.db.QueryRow("SELECT count(*) FROM sessions").Scan(&totalSessions)
	s.db.QueryRow("SELECT count(*) FROM messages").Scan(&totalMessages)
	s.db.QueryRow("SELECT COALESCE(SUM(token_count), 0) FROM messages WHERE token_count IS NOT NULL").Scan(&totalTokens)

	// Get database size
	var dbSize int64
	s.db.QueryRow("SELECT estimated_size FROM pragma_database_size() LIMIT 1").Scan(&dbSize)

	// Get memory usage breakdown
	memoryUsage := []map[string]interface{}{}
	rows, err := s.db.Query("SELECT tag, memory_usage_bytes FROM duckdb_memory() ORDER BY memory_usage_bytes DESC LIMIT 10")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tag string
			var usageBytes int64
			if rows.Scan(&tag, &usageBytes) == nil {
				memoryUsage = append(memoryUsage, map[string]interface{}{
					"tag":         tag,
					"usage_bytes": usageBytes,
				})
			}
		}
	}

	return map[string]interface{}{
		"total_sessions": totalSessions,
		"total_messages": totalMessages,
		"total_tokens":   totalTokens,
		"db_size_bytes":  dbSize,
		"memory_usage":   memoryUsage,
	}, nil
}

func (s *DbService) PurgeDatabase() error {
	_, err := s.db.Exec(`
		DELETE FROM messages;
		DELETE FROM tool_results;
		DELETE FROM sessions;
		DELETE FROM skills;
		DELETE FROM pipelines;
	`)
	return err
}

func (s *DbService) CreateSnapshot(destPath string) error {
	// DuckDB VACUUM INTO creates a copy of the database at the target path
	_, err := s.db.Exec(fmt.Sprintf("VACUUM INTO '%s'", destPath))
	return err
}

// Helper for complex queries (analytical snapshots)
func (s *DbService) QueryRaw(query string, args ...interface{}) (*sql.Rows, error) {
	return s.db.Query(query, args...)
}

func (s *DbService) PreloadSkillsFromDir(dirPath string) error {
	log.Printf("Starting skill preloading from: %s", dirPath)
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No skills to preload
		}
		return err
	}

	count := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		filePath := filepath.Join(dirPath, entry.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			log.Printf("Warning: Failed to read skill file %s: %v", entry.Name(), err)
			continue
		}

		name := strings.TrimSuffix(entry.Name(), ".md")
		name = strings.ReplaceAll(name, "_", " ")
		// Simple title casing
		words := strings.Split(name, " ")
		for i, w := range words {
			if len(w) > 0 {
				words[i] = strings.ToUpper(w[:1]) + strings.ToLower(w[1:])
			}
		}
		name = strings.Join(words, " ")

		// Upsert skill by name
		_, err = s.db.Exec(`
			INSERT INTO skills (name, content, tags, updated_at)
			VALUES (?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT (name) DO UPDATE SET
				content = excluded.content,
				updated_at = excluded.updated_at
		`, name, string(content), "")
		if err != nil {
			log.Printf("Warning: Failed to preload skill %s: %v", name, err)
		} else {
			count++
		}
	}

	if count > 0 {
		log.Printf("Successfully preloaded %d skills from %s", count, dirPath)
	}
	return nil
}
