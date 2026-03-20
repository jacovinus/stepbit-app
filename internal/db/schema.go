package db

const Schema = `
CREATE SEQUENCE IF NOT EXISTS seq_messages_id;
CREATE SEQUENCE IF NOT EXISTS seq_tool_results_id;
CREATE SEQUENCE IF NOT EXISTS seq_skills_id;
CREATE SEQUENCE IF NOT EXISTS seq_pipelines_id;

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    name VARCHAR,
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
`
