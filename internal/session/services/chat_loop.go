package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"stepbit-app/internal/chattools"
	"stepbit-app/internal/core"
	sessionModels "stepbit-app/internal/session/models"
)

type streamingChatClient interface {
	ChatStreamingWithToolCalls(ctx context.Context, messages []core.Message, options core.ChatOptions, tokenChan chan<- core.StreamMessage) (core.ChatStreamResult, error)
}

type toolResultStoreAdapter struct {
	service *SessionService
}

func (a toolResultStoreAdapter) InsertToolResult(result *chattools.ToolResultRecord) (*chattools.ToolResultRecord, error) {
	inserted, err := a.service.InsertToolResult(&sessionModels.ToolResult{
		SessionID: result.SessionID,
		SourceURL: result.SourceURL,
		Content:   result.Content,
	})
	if err != nil {
		return nil, err
	}
	return &chattools.ToolResultRecord{
		ID:        inserted.ID,
		SessionID: inserted.SessionID,
		SourceURL: inserted.SourceURL,
		Content:   inserted.Content,
		CreatedAt: inserted.CreatedAt,
	}, nil
}

func (a toolResultStoreAdapter) GetToolResult(id int64) (*chattools.ToolResultRecord, error) {
	result, err := a.service.GetToolResult(id)
	if err != nil {
		return nil, err
	}
	return &chattools.ToolResultRecord{
		ID:        result.ID,
		SessionID: result.SessionID,
		SourceURL: result.SourceURL,
		Content:   result.Content,
		CreatedAt: result.CreatedAt,
	}, nil
}

func buildToolSystemPrompt(searchEnabled, reasonEnabled bool, definitions []chattools.ToolDefinition) string {
	var builder strings.Builder
	builder.WriteString("You are Stepbit's chat assistant. Answer clearly and helpfully.\n")
	builder.WriteString(fmt.Sprintf("Current Date: %s.\n", time.Now().Format("Monday, January 02, 2006")))
	if reasonEnabled {
		builder.WriteString("Reason step-by-step before giving the final answer.\n")
	}
	if len(definitions) > 0 {
		builder.WriteString("When a tool is needed, respond with a JSON array of tool calls and nothing else after that array.\n")
		builder.WriteString("Tool call format: [{\"name\":\"tool_name\",\"arguments\":{...}}]\n")
		builder.WriteString("Available tools:\n")
		for _, definition := range definitions {
			builder.WriteString(fmt.Sprintf("- %s: %s Parameters: %s\n", definition.Name, definition.Description, definition.Parameters))
		}
	} else if searchEnabled {
		builder.WriteString("Search is enabled but no tools are available; answer with best effort.\n")
	}
	return builder.String()
}
