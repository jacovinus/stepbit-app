package services

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"stepbit-app/internal/chattools"
	"stepbit-app/internal/core"
	sessionModels "stepbit-app/internal/session/models"
)

type streamingChatClient interface {
	ChatStreamingStructured(ctx context.Context, messages []core.Message, options core.ChatOptions, tokenChan chan<- core.StreamMessage) (core.ChatStreamResult, error)
	ChatStreamingWithToolCalls(ctx context.Context, messages []core.Message, options core.ChatOptions, tokenChan chan<- core.StreamMessage) (core.ChatStreamResult, error)
	CancelChat(ctx context.Context, sessionID string) error
}

type wsWriteFunc func(message sessionModels.WsServerMessage)

type activeChatRun struct {
	cancel context.CancelFunc
	done   chan struct{}
}

type structuredChatResultError struct {
	result core.ChatStreamResult
}

func (e structuredChatResultError) Error() string {
	return "structured chat completed"
}

type activeRunRegistry struct {
	mu   sync.Mutex
	runs map[string]*activeChatRun
}

func newActiveRunRegistry() *activeRunRegistry {
	return &activeRunRegistry{
		runs: map[string]*activeChatRun{},
	}
}

func (r *activeRunRegistry) set(sessionID string, run *activeChatRun) (previous *activeChatRun) {
	r.mu.Lock()
	defer r.mu.Unlock()
	previous = r.runs[sessionID]
	r.runs[sessionID] = run
	return previous
}

func (r *activeRunRegistry) get(sessionID string) *activeChatRun {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.runs[sessionID]
}

func (r *activeRunRegistry) clear(sessionID string, run *activeChatRun) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if current, ok := r.runs[sessionID]; ok && current == run {
		delete(r.runs, sessionID)
	}
}

func (r *activeRunRegistry) remove(sessionID string) *activeChatRun {
	r.mu.Lock()
	defer r.mu.Unlock()
	run := r.runs[sessionID]
	delete(r.runs, sessionID)
	return run
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
		builder.WriteString("The `arguments` object must contain only real values for the tool inputs.\n")
		builder.WriteString("Do not return JSON Schema fields such as `type`, `properties`, `description`, or `required` inside `arguments`.\n")
		builder.WriteString("Do not explain the tool call, do not add prose after the JSON array, and do not repeat the raw JSON once the tool result comes back.\n")
		builder.WriteString("Available tools:\n")
		for _, definition := range definitions {
			builder.WriteString(fmt.Sprintf("- %s: %s Parameters: %s\n", definition.Name, definition.Description, definition.Parameters))
		}
	} else if searchEnabled {
		builder.WriteString("Search is enabled but no tools are available; answer with best effort.\n")
	}
	return builder.String()
}
