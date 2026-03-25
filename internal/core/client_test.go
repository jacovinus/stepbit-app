package core

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
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
