package models

import (
	"time"

	"github.com/google/uuid"
)

// Session represents a chat session
type Session struct {
	ID        uuid.UUID              `json:"id"`
	Name      string                 `json:"name"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// Message represents a chat message
type Message struct {
	ID         int64                  `json:"id"`
	SessionID  uuid.UUID              `json:"session_id"`
	Role       string                 `json:"role"`
	Content    string                 `json:"content"`
	Model      *string                `json:"model"`
	TokenCount *int32                 `json:"token_count"`
	CreatedAt  time.Time              `json:"created_at"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// ToolResult represents a tool execution result
type ToolResult struct {
	ID        int64     `json:"id"`
	SessionID uuid.UUID `json:"session_id"`
	SourceURL string    `json:"source_url"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

// Skill represents a stored skill (Markdown file)
type Skill struct {
	ID        int64      `json:"id"`
	Name      string     `json:"name"`
	Content   string     `json:"content"`
	Tags      string     `json:"tags"`
	SourceURL *string    `json:"source_url"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// Pipeline represents a workflow definition
type Pipeline struct {
	ID         int64                  `json:"id"`
	Name       string                 `json:"name"`
	Definition map[string]interface{} `json:"definition"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}
// API Models
type PaginationQuery struct {
	Limit  int `query:"limit"`
	Offset int `query:"offset"`
}

type CreateSessionRequest struct {
	Name     string                 `json:"name"`
	Metadata map[string]interface{} `json:"metadata"`
}

type UpdateSessionRequest struct {
	Name     *string                `json:"name"`
	Metadata map[string]interface{} `json:"metadata"`
}

type CreateSkillRequest struct {
	Name      string  `json:"name"`
	Content   string  `json:"content"`
	Tags      string  `json:"tags"`
	SourceURL *string `json:"source_url"`
}

type UpdateSkillRequest struct {
	Name      *string `json:"name"`
	Content   *string `json:"content"`
	Tags      *string `json:"tags"`
	SourceURL *string `json:"source_url"`
}

type CreatePipelineRequest struct {
	Name       string                 `json:"name"`
	Definition map[string]interface{} `json:"definition"`
}

type UpdatePipelineRequest struct {
	Name       *string                `json:"name"`
	Definition map[string]interface{} `json:"definition"`
}

type SqlQueryRequest struct {
	SQL string `json:"sql"`
}

type SqlQueryResponse struct {
	Columns []string                 `json:"columns"`
	Rows    []map[string]interface{} `json:"rows"`
}

// WebSocket Models
type WsClientMessage struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Search  *bool  `json:"search"`
	Reason  *bool  `json:"reason"`
}

type WsServerMessage struct {
	Type    string `json:"type"`
	Content string `json:"content"`
}
