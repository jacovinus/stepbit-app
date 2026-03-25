package chattools

import (
	"context"
	"fmt"
	"time"

	"stepbit-app/internal/core"

	"github.com/google/uuid"
)

type ToolResultStore interface {
	InsertToolResult(result *ToolResultRecord) (*ToolResultRecord, error)
	GetToolResult(id int64) (*ToolResultRecord, error)
}

type ToolResultRecord struct {
	ID        int64
	SessionID uuid.UUID
	SourceURL string
	Content   string
	CreatedAt time.Time
}

type Tool interface {
	Definition() ToolDefinition
	Call(ctx context.Context, arguments string, sessionID uuid.UUID, store ToolResultStore) (string, error)
}

type ToolDefinition struct {
	Name        string
	Description string
	Parameters  string
}

type Registry struct {
	tools map[string]Tool
	order []Tool
}

func NewRegistry() *Registry {
	registry := &Registry{
		tools: map[string]Tool{},
	}

	registry.Register(NewSearchTool())
	registry.Register(NewReadFullContentTool())
	registry.Register(NewReadURLTool())
	return registry
}

func (r *Registry) Register(tool Tool) {
	r.tools[tool.Definition().Name] = tool
	r.order = append(r.order, tool)
}

func (r *Registry) Definitions() []ToolDefinition {
	definitions := make([]ToolDefinition, 0, len(r.order))
	for _, tool := range r.order {
		definitions = append(definitions, tool.Definition())
	}
	return definitions
}

func (r *Registry) DefinitionsWithoutWebTools(searchEnabled bool) []ToolDefinition {
	if searchEnabled {
		return r.Definitions()
	}

	definitions := make([]ToolDefinition, 0, len(r.order))
	for _, tool := range r.order {
		name := tool.Definition().Name
		if name == "internet_search" || name == "read_full_content" || name == "read_url" {
			continue
		}
		definitions = append(definitions, tool.Definition())
	}
	return definitions
}

func (r *Registry) CallTool(ctx context.Context, call core.ToolCall, sessionID uuid.UUID, store ToolResultStore) (string, error) {
	tool, ok := r.tools[call.Function.Name]
	if !ok {
		return "", fmt.Errorf("tool %q not found", call.Function.Name)
	}
	return tool.Call(ctx, call.Function.Arguments, sessionID, store)
}
