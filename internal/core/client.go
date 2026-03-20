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
		BaseURL:      baseURL,
		APIKey:       apiKey,
		DefaultModel: defaultModel,
		client: &http.Client{
			Timeout: 300 * time.Second,
		},
	}
}

// DoAuthenticatedRequest performs an authenticated request with rotating token logic
func (c *StepbitCoreClient) DoAuthenticatedRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	url := c.BaseURL + path
	
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

	// 1. Try with rotating token
	c.tokenMu.RLock()
	token := c.rotatingToken
	c.tokenMu.RUnlock()

	if token != "" {
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

	// 2. Fallback to Master API Key
	if bodyReader != nil {
		bodyReader.Seek(0, 0)
	}
	req, _ := http.NewRequestWithContext(ctx, method, url, reqBody)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusOK {
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

	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/v1/chat/completions", body)
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
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodGet, "/llm/mcp/tools", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("stepbit-core returned status %d", resp.StatusCode)
	}

	var tools []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&tools); err != nil {
		return nil, err
	}
	return tools, nil
}

// ExecuteReasoning executes a reasoning graph synchronously
func (c *StepbitCoreClient) ExecuteReasoning(ctx context.Context, graph interface{}) (interface{}, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/llm/reasoning/execute", graph)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("reasoning execution failed (%d): %s", resp.StatusCode, string(body))
	}

	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// ExecuteReasoningStream opens an SSE stream for reasoning execution and returns the raw response
func (c *StepbitCoreClient) ExecuteReasoningStream(ctx context.Context, graph interface{}) (*http.Response, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/llm/reasoning/execute/stream", graph)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("reasoning stream failed with status %d", resp.StatusCode)
	}
	return resp, nil
}

// CheckHealth verifies if stepbit-core is reachable
func (c *StepbitCoreClient) CheckHealth(ctx context.Context) (bool, string) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/health", nil)
	if err != nil {
		return false, "Failed to create request"
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return false, "stepbit-core unreachable"
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return true, "stepbit-core is online"
	}
	return false, fmt.Sprintf("stepbit-core returned status %d", resp.StatusCode)
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
