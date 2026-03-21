package core

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/goccy/go-json"
)

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// StreamMessage represents a chunk of data from the stream
type StreamMessage struct {
	Type    string // "chunk" or "thinking"
	Content string
}

// ChatOptions represents options for the chat request
type ChatOptions struct {
	Model       string  `json:"model,omitempty"`
	Temperature float64 `json:"temperature,omitempty"`
	MaxTokens   int     `json:"max_tokens,omitempty"`
	Stream      bool    `json:"stream"`
	Search      bool    `json:"search,omitempty"`
	Reason      bool    `json:"reason,omitempty"`
	BaseURL     string  `json:"-"` // Internal override
}

// StepbitCoreClient handles communication with stepbit-core
type StepbitCoreClient struct {
	BaseURL      string
	APIKey       string
	DefaultModel string
	client       *http.Client
	
	rotatingToken string
	tokenMu       sync.RWMutex
}

// NewStepbitCoreClient creates a new client for stepbit-core
func NewStepbitCoreClient(baseURL, apiKey, defaultModel string) *StepbitCoreClient {
	return &StepbitCoreClient{
		BaseURL:      strings.TrimSuffix(baseURL, "/"),
		APIKey:       apiKey,
		DefaultModel: defaultModel,
		client: &http.Client{
			Timeout: 300 * time.Second,
		},
	}
}

func (c *StepbitCoreClient) GetClient() *http.Client {
	return c.client
}

// DoAuthenticatedRequest performs an authenticated request with rotating token logic
func (c *StepbitCoreClient) DoAuthenticatedRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	return c.DoAuthenticatedRequestWithURL(ctx, method, c.BaseURL+path, body)
}

func (c *StepbitCoreClient) DoAuthenticatedRequestWithURL(ctx context.Context, method, url string, body interface{}) (*http.Response, error) {
	var bodyReader *bytes.Reader
	if body != nil {
		jsonBytes, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(jsonBytes)
	}

	var reqBody io.Reader
	if body != nil {
		reqBody = bodyReader
	}

	// 1. Try with rotating token (only for Core)
	c.tokenMu.RLock()
	token := c.rotatingToken
	c.tokenMu.RUnlock()

	if token != "" && strings.Contains(url, c.BaseURL) {
		req, _ := http.NewRequestWithContext(ctx, method, url, reqBody)
		req.Header.Set("Authorization", "Bearer "+token)
		if reqBody != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		resp, err := c.client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			c.updateToken(resp)
			return resp, nil
		}
		
		if resp != nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusUnauthorized {
				c.tokenMu.Lock()
				c.rotatingToken = ""
				c.tokenMu.Unlock()
			}
		}
	}

	// 2. Fallback to Master API Key (only for Core)
	if bodyReader != nil {
		bodyReader.Seek(0, 0)
	}
	req, _ := http.NewRequestWithContext(ctx, method, url, reqBody)
	
	// Only add Auth if we are talking to Stepbit Core
	if strings.Contains(url, c.BaseURL) {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}
	
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusOK && strings.Contains(url, c.BaseURL) {
		c.updateToken(resp)
	}

	return resp, nil
}

func (c *StepbitCoreClient) updateToken(resp *http.Response) {
	if nextToken := resp.Header.Get("X-Next-Token"); nextToken != "" {
		c.tokenMu.Lock()
		c.rotatingToken = nextToken
		c.tokenMu.Unlock()
	}
}

// ChatStreaming handles a streaming chat request
func (c *StepbitCoreClient) ChatStreaming(ctx context.Context, messages []Message, options ChatOptions, tokenChan chan<- StreamMessage) error {
	if options.Model == "" {
		options.Model = c.DefaultModel
	}

	body := map[string]interface{}{
		"model":    options.Model,
		"messages": messages,
		"stream":   true,
	}
	if options.Temperature > 0 {
		body["temperature"] = options.Temperature
	}
	if options.MaxTokens > 0 {
		body["max_tokens"] = options.MaxTokens
	}

	baseURL := c.BaseURL
	if options.BaseURL != "" {
		baseURL = options.BaseURL
	}
	url := baseURL + "/v1/chat/completions"

	resp, err := c.DoAuthenticatedRequestWithURL(ctx, http.MethodPost, url, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			break
		}
		line = fmt.Sprintf("%s", line) // ensure string
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			data = strings.TrimSpace(data)
			
			if data == "[DONE]" {
				break
			}

			var chunk map[string]interface{}
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				continue
			}

			if choices, ok := chunk["choices"].([]interface{}); ok && len(choices) > 0 {
				if choice, ok := choices[0].(map[string]interface{}); ok {
					if delta, ok := choice["delta"].(map[string]interface{}); ok {
						// 1. Handle Thinking/Reasoning Content
						if reasoning, ok := delta["reasoning_content"].(string); ok && reasoning != "" {
							select {
							case tokenChan <- StreamMessage{Type: "thinking", Content: reasoning}:
							case <-ctx.Done():
								return ctx.Err()
							}
						}

						// 2. Handle Standard Content
						if content, ok := delta["content"].(string); ok && content != "" {
							select {
							case tokenChan <- StreamMessage{Type: "chunk", Content: content}:
							case <-ctx.Done():
								return ctx.Err()
							}
						}
					}
				}
			}
		}
	}

	return nil
}

// GetMCPTools fetches the list of MCP tools from stepbit-core
func (c *StepbitCoreClient) GetMCPTools(ctx context.Context) ([]map[string]interface{}, error) {
	// Try /v1/mcp/tools first (Rust) then /llm/mcp/tools (legacy)
	var lastErr error
	for _, path := range []string{"/v1/mcp/tools", "/llm/mcp/tools"} {
		resp, err := c.DoAuthenticatedRequest(ctx, http.MethodGet, path, nil)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("status %d", resp.StatusCode)
			continue
		}

		var result struct {
			Tools []map[string]interface{} `json:"tools"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			lastErr = err
			continue
		}
		return result.Tools, nil
	}
	return []map[string]interface{}{}, lastErr
}

// ExecuteReasoning executes a reasoning graph synchronously
func (c *StepbitCoreClient) ExecuteReasoning(ctx context.Context, graph interface{}) (map[string]interface{}, error) {
	// Try /v1 prefix first (Rust)
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/v1/reasoning/execute", graph)
	
	// Fallback to legacy (/llm/) ONLY if we got a 404 or a connection error
	if err != nil || (resp != nil && resp.StatusCode == http.StatusNotFound) {
		if resp != nil {
			resp.Body.Close()
		}
		resp, err = c.DoAuthenticatedRequest(ctx, http.MethodPost, "/llm/reasoning/execute", graph)
	}
	
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("reasoning execution failed (%d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// ExecuteReasoningStream opens an SSE stream for reasoning execution and returns the raw response
func (c *StepbitCoreClient) ExecuteReasoningStream(ctx context.Context, graph interface{}) (io.ReadCloser, error) {
	// Try /v1 prefix first (Rust)
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/v1/reasoning/execute/stream", graph)
	
	// Fallback to legacy (/llm/) ONLY if we got a 404 or a connection error
	if err != nil || (resp != nil && resp.StatusCode == http.StatusNotFound) {
		if resp != nil {
			resp.Body.Close()
		}
		resp, err = c.DoAuthenticatedRequest(ctx, http.MethodPost, "/llm/reasoning/execute/stream", graph)
	}

	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("reasoning stream failed with status %d", resp.StatusCode)
	}
	return resp.Body, nil
}

// CheckHealth verifies if stepbit-core is reachable
func (c *StepbitCoreClient) CheckHealth(ctx context.Context) (bool, string) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	// Try /ready first (Rust core) then /health (Python core fallback)
	endpoints := []string{"/ready", "/health"}
	var lastErr error

	for _, ep := range endpoints {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+ep, nil)
		if err != nil {
			lastErr = err
			continue
		}

		resp, err := c.client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			return true, "stepbit-core is online"
		}
		lastErr = fmt.Errorf("endpoint %s returned status %d", ep, resp.StatusCode)
	}

	if lastErr != nil {
		return false, fmt.Sprintf("stepbit-core unreachable: %v", lastErr)
	}
	return false, "stepbit-core unreachable"
}

// DiscoverModels fetches available models from stepbit-core
func (c *StepbitCoreClient) DiscoverModels(ctx context.Context) ([]string, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodGet, "/v1/models", nil)
	if err != nil {
		return []string{c.DefaultModel}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return []string{c.DefaultModel}, nil
	}

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return []string{c.DefaultModel}, nil
	}

	models := make([]string, 0, len(result.Data))
	for _, m := range result.Data {
		models = append(models, m.ID)
	}
	if len(models) == 0 {
		return []string{c.DefaultModel}, nil
	}
	return models, nil
}
