package models

import (
	"time"
)

// Pipeline represents a workflow definition
type Pipeline struct {
	ID         int64                  `json:"id"`
	Name       string                 `json:"name"`
	Definition map[string]interface{} `json:"definition"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

type CreatePipelineRequest struct {
	Name       string                 `json:"name"`
	Definition map[string]interface{} `json:"definition"`
}

type UpdatePipelineRequest struct {
	Name       *string                `json:"name"`
	Definition map[string]interface{} `json:"definition"`
}
