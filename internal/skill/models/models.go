package models

import (
	"time"
)

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
