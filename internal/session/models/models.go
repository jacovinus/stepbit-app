package models

import (
	"time"

	"github.com/google/uuid"
)

// Session represents a chat session
type Session struct {
	ID        uuid.UUID              `json:"id"`
	Title     string                 `json:"title"`
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

// API Models
type CreateSessionRequest struct {
	Title    string                 `json:"title"`
	Metadata map[string]interface{} `json:"metadata"`
}

type UpdateSessionRequest struct {
	Title    *string                `json:"title"`
	Metadata map[string]interface{} `json:"metadata"`
}

// WebSocket Models
type WsClientMessage struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Stream  *bool  `json:"stream"`
	Search  *bool  `json:"search"`
	Reason  *bool  `json:"reason"`
}

type WsServerMessage struct {
	Type    string `json:"type"` // "chunk", "status", "trace", "done", "error"
	Content string `json:"content"`
}
