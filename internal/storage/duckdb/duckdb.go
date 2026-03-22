package duckdb

import (
	"database/sql"
	"fmt"
	_ "github.com/marcboeker/go-duckdb"
)

func NewConnection(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("duckdb", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open duckdb: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping duckdb: %w", err)
	}

	return db, nil
}

func InitSchema(db *sql.DB) error {
	schema := `
	CREATE SEQUENCE IF NOT EXISTS seq_messages_id;
	CREATE SEQUENCE IF NOT EXISTS seq_tool_results_id;
	CREATE SEQUENCE IF NOT EXISTS seq_skills_id;
	CREATE SEQUENCE IF NOT EXISTS seq_pipelines_id;
	CREATE SEQUENCE IF NOT EXISTS seq_execution_runs_id;

	CREATE TABLE IF NOT EXISTS sessions (
		id UUID PRIMARY KEY,
		title VARCHAR,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		metadata JSON DEFAULT '{}'
	);

	CREATE TABLE IF NOT EXISTS messages (
		id BIGINT PRIMARY KEY DEFAULT nextval('seq_messages_id'),
		session_id UUID,
		role VARCHAR NOT NULL,
		content TEXT NOT NULL,
		model VARCHAR,
		token_count INTEGER,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		metadata JSON DEFAULT '{}'
	);

	CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

	CREATE TABLE IF NOT EXISTS tool_results (
		id BIGINT PRIMARY KEY DEFAULT nextval('seq_tool_results_id'),
		session_id UUID,
		source_url VARCHAR,
		content TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_tool_results_session ON tool_results(session_id);

	CREATE TABLE IF NOT EXISTS skills (
		id         BIGINT PRIMARY KEY DEFAULT nextval('seq_skills_id'),
		name       VARCHAR NOT NULL UNIQUE,
		content    TEXT NOT NULL,
		tags       VARCHAR DEFAULT '',
		source_url VARCHAR,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS pipelines (
		id BIGINT PRIMARY KEY DEFAULT nextval('seq_pipelines_id'),
		name VARCHAR NOT NULL,
		definition JSON NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS execution_runs (
		id BIGINT PRIMARY KEY DEFAULT nextval('seq_execution_runs_id'),
		source_type VARCHAR NOT NULL,
		source_id VARCHAR NOT NULL,
		action_type VARCHAR NOT NULL,
		status VARCHAR NOT NULL,
		request_payload JSON DEFAULT '{}',
		response_payload JSON DEFAULT '{}',
		error TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		completed_at TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_execution_runs_created_at ON execution_runs(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_execution_runs_source ON execution_runs(source_type, source_id, created_at DESC);
	`
	_, err := db.Exec(schema)
	if err != nil {
		return err
	}

	// Aggressive Migrations: Ensure ALL columns exist regardless of when DB was created
	// Sessions
	db.Exec("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS title VARCHAR")
	db.Exec("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
	db.Exec("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
	db.Exec("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}'")
	// Handle name -> title rename if name exists (ignore error if title already exists)
	db.Exec("ALTER TABLE sessions RENAME COLUMN name TO title")

	// Messages
	db.Exec("ALTER TABLE messages ADD COLUMN IF NOT EXISTS session_id UUID")
	db.Exec("ALTER TABLE messages ADD COLUMN IF NOT EXISTS role VARCHAR")
	db.Exec("ALTER TABLE messages ADD COLUMN IF NOT EXISTS content TEXT")
	db.Exec("ALTER TABLE messages ADD COLUMN IF NOT EXISTS model VARCHAR")
	db.Exec("ALTER TABLE messages ADD COLUMN IF NOT EXISTS token_count INTEGER")
	db.Exec("ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
	db.Exec("ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}'")
	// Handle tokens -> token_count rename if tokens exists
	db.Exec("ALTER TABLE messages RENAME COLUMN tokens TO token_count")

	// Skills
	db.Exec("ALTER TABLE skills ADD COLUMN IF NOT EXISTS tags VARCHAR DEFAULT ''")
	db.Exec("ALTER TABLE skills ADD COLUMN IF NOT EXISTS source_url VARCHAR")
	db.Exec("ALTER TABLE skills ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
	db.Exec("ALTER TABLE skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

	// Pipelines
	db.Exec("ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
	db.Exec("ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

	// Execution runs
	db.Exec("ALTER TABLE execution_runs ADD COLUMN IF NOT EXISTS request_payload JSON DEFAULT '{}'")
	db.Exec("ALTER TABLE execution_runs ADD COLUMN IF NOT EXISTS response_payload JSON DEFAULT '{}'")
	db.Exec("ALTER TABLE execution_runs ADD COLUMN IF NOT EXISTS error TEXT")
	db.Exec("ALTER TABLE execution_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
	db.Exec("ALTER TABLE execution_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP")

	return nil
}
