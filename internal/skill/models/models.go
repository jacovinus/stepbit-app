package models

import (
	"time"
)

type SkillPolicy struct {
	Description      string   `json:"description,omitempty"`
	AllowedTools     []string `json:"allowed_tools,omitempty"`
	CitationPolicy   string   `json:"citation_policy,omitempty"`
	PreferredOutputs []string `json:"preferred_outputs,omitempty"`
}

// Skill represents a stored skill (Markdown file)
type Skill struct {
	ID        int64        `json:"id"`
	Name      string       `json:"name"`
	Content   string       `json:"content"`
	Tags      string       `json:"tags"`
	Policy    *SkillPolicy `json:"policy,omitempty"`
	SourceURL *string      `json:"source_url"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

type CreateSkillRequest struct {
	Name      string       `json:"name"`
	Content   string       `json:"content"`
	Tags      string       `json:"tags"`
	Policy    *SkillPolicy `json:"policy,omitempty"`
	SourceURL *string      `json:"source_url"`
}

type UpdateSkillRequest struct {
	Name      *string      `json:"name"`
	Content   *string      `json:"content"`
	Tags      *string      `json:"tags"`
	Policy    *SkillPolicy `json:"policy,omitempty"`
	SourceURL *string      `json:"source_url"`
}

type FetchURLRequest struct {
	URL  string `json:"url"`
	Name string `json:"name"`
	Tags string `json:"tags"`
}
