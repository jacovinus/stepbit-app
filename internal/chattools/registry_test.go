package chattools

import (
	"context"
	"testing"
	"time"

	"stepbit-app/internal/core"

	"github.com/google/uuid"
)

type stubToolStore struct {
	lastInserted *ToolResultRecord
	results      map[int64]*ToolResultRecord
	nextID       int64
}

func (s *stubToolStore) InsertToolResult(result *ToolResultRecord) (*ToolResultRecord, error) {
	s.nextID++
	inserted := &ToolResultRecord{
		ID:        s.nextID,
		SessionID: result.SessionID,
		SourceURL: result.SourceURL,
		Content:   result.Content,
		CreatedAt: time.Now(),
	}
	if s.results == nil {
		s.results = map[int64]*ToolResultRecord{}
	}
	s.results[inserted.ID] = inserted
	s.lastInserted = inserted
	return inserted, nil
}

func (s *stubToolStore) GetToolResult(id int64) (*ToolResultRecord, error) {
	return s.results[id], nil
}

func TestRegistry_CallTool_ReadFullContent(t *testing.T) {
	registry := NewRegistry()
	store := &stubToolStore{
		results: map[int64]*ToolResultRecord{
			7: {
				ID:        7,
				SessionID: uuid.New(),
				SourceURL: "https://example.com",
				Content:   "full page",
			},
		},
	}

	output, err := registry.CallTool(context.Background(), core.ToolCall{
		Function: core.FunctionCall{
			Name:      "read_full_content",
			Arguments: `{"source_id":7}`,
		},
	}, uuid.New(), store)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if output != "Source URL: https://example.com\nFull Content:\nfull page" {
		t.Fatalf("unexpected output: %q", output)
	}
}
