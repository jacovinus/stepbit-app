package core

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestStepbitCoreClient_TokenRotation(t *testing.T) {
	var requestCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if requestCount == 1 {
			// First request with master key, return a rotating token
			w.Header().Set("X-Next-Token", "next-token-123")
			w.WriteHeader(http.StatusOK)
		} else {
			// Subsequent request, check if rotating token is used
			auth := r.Header.Get("Authorization")
			if auth == "Bearer next-token-123" {
				w.WriteHeader(http.StatusOK)
			} else {
				w.WriteHeader(http.StatusUnauthorized)
			}
		}
	}))
	defer server.Close()

	client := NewStepbitCoreClient(server.URL, "master-key", "model-1")

	// First call
	_, err := client.DoAuthenticatedRequest(context.Background(), http.MethodGet, "/test", nil)
	if err != nil {
		t.Fatalf("First call failed: %v", err)
	}

	if client.rotatingToken != "next-token-123" {
		t.Errorf("Expected rotating token to be set, got %s", client.rotatingToken)
	}

	// Second call
	_, err = client.DoAuthenticatedRequest(context.Background(), http.MethodGet, "/test", nil)
	if err != nil {
		t.Fatalf("Second call failed: %v", err)
	}
}

func TestStepbitCoreClient_ChatStreaming(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprintf(w, "data: %s\n\n", `{"choices":[{"delta":{"content":"Hello"}}]}`)
		fmt.Fprintf(w, "data: %s\n\n", `{"choices":[{"delta":{"content":" world"}}]}`)
		fmt.Fprintf(w, "data: [DONE]\n\n")
	}))
	defer server.Close()

	client := NewStepbitCoreClient(server.URL, "master-key", "model-1")
	tokenChan := make(chan StreamMessage, 10)

	err := client.ChatStreaming(context.Background(), []Message{{Role: "user", Content: "hi"}}, ChatOptions{}, tokenChan)
	if err != nil {
		t.Fatalf("ChatStreaming failed: %v", err)
	}
	close(tokenChan)

	var result string
	for msg := range tokenChan {
		result += msg.Content
	}

	if result != "Hello world" {
		t.Errorf("Expected 'Hello world', got '%s'", result)
	}
}

func TestStepbitCoreClient_ChatStreaming_ForwardsSearchAndReasonFlags(t *testing.T) {
	var requestBody map[string]any

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}

		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprintf(w, "data: [DONE]\n\n")
	}))
	defer server.Close()

	client := NewStepbitCoreClient(server.URL, "master-key", "model-1")
	tokenChan := make(chan StreamMessage, 1)

	err := client.ChatStreaming(context.Background(), []Message{{Role: "user", Content: "search this"}}, ChatOptions{
		Model:  "model-1",
		Search: true,
		Reason: true,
	}, tokenChan)
	if err != nil {
		t.Fatalf("ChatStreaming failed: %v", err)
	}

	if got := requestBody["model"]; got != "model-1" {
		t.Fatalf("expected model-1 in request body, got %#v", got)
	}

	if got := requestBody["search"]; got != true {
		t.Fatalf("expected search=true in request body, got %#v", got)
	}

	if got := requestBody["reason"]; got != true {
		t.Fatalf("expected reason=true in request body, got %#v", got)
	}
}

func TestStepbitCoreClient_ChatStreamingWithToolCalls_ExtractsToolCalls(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprintf(w, "data: %s\n\n", `{"choices":[{"delta":{"content":"Looking this up.\n"}}]}`)
		fmt.Fprintf(w, "data: %s\n\n", `{"choices":[{"delta":{"content":"[{\"name\":\"internet_search\",\"arguments\":{\"query\":\"latest rust\"}}]"}}]}`)
		fmt.Fprintf(w, "data: [DONE]\n\n")
	}))
	defer server.Close()

	client := NewStepbitCoreClient(server.URL, "master-key", "model-1")
	tokenChan := make(chan StreamMessage, 10)

	result, err := client.ChatStreamingWithToolCalls(context.Background(), []Message{{Role: "user", Content: "hi"}}, ChatOptions{}, tokenChan)
	if err != nil {
		t.Fatalf("ChatStreamingWithToolCalls failed: %v", err)
	}
	close(tokenChan)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Function.Name != "internet_search" {
		t.Fatalf("expected internet_search, got %q", result.ToolCalls[0].Function.Name)
	}
}

func TestStepbitCoreClient_ChatStreamingStructured_ParsesStructuredEvents(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/responses" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprintf(w, "data: %s\n\n", `{"event":"response.created","data":{"id":"resp-1","turn_context":{"search_enabled":true,"reason_enabled":false,"requested_tools":["internet_search"],"available_tools":[{"name":"internet_search","provider_id":"web","enabled":true,"read_only":true,"open_world":true,"tags":["web"]}],"used_tools":["internet_search"]}}}`)
		fmt.Fprintf(w, "data: %s\n\n", `{"event":"response.tool_call.started","data":{"tool_name":"internet_search"}}`)
		fmt.Fprintf(w, "data: %s\n\n", `{"event":"response.output_text.delta","data":{"delta":"Hello"}}`)
		fmt.Fprintf(w, "data: %s\n\n", `{"event":"response.output_text.delta","data":{"delta":" world"}}`)
		fmt.Fprintf(w, "data: %s\n\n", `{"event":"response.completed","data":{"finish_reason":"stop"}}`)
	}))
	defer server.Close()

	client := NewStepbitCoreClient(server.URL, "master-key", "model-1")
	tokenChan := make(chan StreamMessage, 10)

	result, err := client.ChatStreamingStructured(context.Background(), []Message{{Role: "user", Content: "hi"}}, ChatOptions{}, tokenChan)
	if err != nil {
		t.Fatalf("ChatStreamingStructured failed: %v", err)
	}
	close(tokenChan)

	var chunks []string
	var statuses []string
	for msg := range tokenChan {
		switch msg.Type {
		case "chunk":
			chunks = append(chunks, msg.Content)
		case "status":
			statuses = append(statuses, msg.Content)
		}
	}

	if !result.Structured {
		t.Fatalf("expected structured result")
	}
	if result.TurnContext == nil {
		t.Fatalf("expected turn context to be parsed")
	}
	if !result.TurnContext.SearchEnabled || len(result.TurnContext.AvailableTools) != 1 {
		t.Fatalf("unexpected turn context: %#v", result.TurnContext)
	}
	if !result.UsedTools {
		t.Fatalf("expected tool usage to be detected")
	}
	if len(result.ToolEvents) != 1 || result.ToolEvents[0] != "internet_search" {
		t.Fatalf("unexpected tool events: %#v", result.ToolEvents)
	}
	if strings.Join(chunks, "") != "Hello world" {
		t.Fatalf("unexpected chunk output: %q", strings.Join(chunks, ""))
	}
	if len(statuses) != 1 || statuses[0] != "Running tool: internet_search..." {
		t.Fatalf("unexpected statuses: %#v", statuses)
	}
}

func TestStepbitCoreClient_ChatStreamingStructured_ReturnsUnavailableForUnsupportedEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := NewStepbitCoreClient(server.URL, "master-key", "model-1")
	tokenChan := make(chan StreamMessage, 1)

	_, err := client.ChatStreamingStructured(context.Background(), []Message{{Role: "user", Content: "hi"}}, ChatOptions{}, tokenChan)
	if !errors.Is(err, ErrStructuredResponsesUnavailable) {
		t.Fatalf("expected ErrStructuredResponsesUnavailable, got %v", err)
	}
}

func TestStepbitCoreClient_CancelChat(t *testing.T) {
	var requestedPath string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestedPath = r.URL.Path
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewStepbitCoreClient(server.URL, "master-key", "model-1")
	if err := client.CancelChat(context.Background(), "session-123"); err != nil {
		t.Fatalf("CancelChat failed: %v", err)
	}

	if requestedPath != "/v1/chat/cancel/session-123" {
		t.Fatalf("unexpected cancel path: %s", requestedPath)
	}
}

func TestStepbitCoreClient_GetMCPTools_PrefersCapabilityInventoryEndpoint(t *testing.T) {
	var requestedPaths []string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestedPaths = append(requestedPaths, r.URL.Path)
		switch r.URL.Path {
		case "/v1/tools":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{"tools":[{"name":"internet_search","provider_id":"web","enabled":true}]}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewStepbitCoreClient(server.URL, "master-key", "model-1")
	tools, err := client.GetMCPTools(context.Background())
	if err != nil {
		t.Fatalf("GetMCPTools failed: %v", err)
	}

	if len(tools) != 1 || tools[0]["name"] != "internet_search" {
		t.Fatalf("unexpected tools payload: %#v", tools)
	}
	if len(requestedPaths) != 1 || requestedPaths[0] != "/v1/tools" {
		t.Fatalf("expected only /v1/tools to be requested, got %#v", requestedPaths)
	}
}

func TestStepbitCoreClient_GetMCPProviders_FallsBackToLegacyEndpoint(t *testing.T) {
	var requestedPaths []string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestedPaths = append(requestedPaths, r.URL.Path)
		switch r.URL.Path {
		case "/v1/providers":
			http.NotFound(w, r)
		case "/v1/mcp/providers":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{"providers":[{"name":"workspace","enabled":true}]}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewStepbitCoreClient(server.URL, "master-key", "model-1")
	providers, err := client.GetMCPProviders(context.Background())
	if err != nil {
		t.Fatalf("GetMCPProviders failed: %v", err)
	}

	if len(providers) != 1 || providers[0]["name"] != "workspace" {
		t.Fatalf("unexpected providers payload: %#v", providers)
	}
	if strings.Join(requestedPaths, ",") != "/v1/providers,/v1/mcp/providers" {
		t.Fatalf("unexpected request order: %#v", requestedPaths)
	}
}

func TestParseMetricsSummary(t *testing.T) {
	metrics := `
# HELP requests_total Total API requests
# TYPE requests_total counter
requests_total 42
tokens_generated_total 2048
active_sessions 3
token_latency_ms_sum 125
token_latency_ms_count 5
`

	summary := parseMetricsSummary(metrics)

	if summary.RequestsTotal != 42 {
		t.Fatalf("expected requests_total 42, got %v", summary.RequestsTotal)
	}
	if summary.TokensGenerated != 2048 {
		t.Fatalf("expected tokens_generated_total 2048, got %v", summary.TokensGenerated)
	}
	if summary.ActiveSessions != 3 {
		t.Fatalf("expected active_sessions 3, got %v", summary.ActiveSessions)
	}
	if summary.TokenLatencyAvgMs != 25 {
		t.Fatalf("expected token_latency_avg_ms 25, got %v", summary.TokenLatencyAvgMs)
	}
}
