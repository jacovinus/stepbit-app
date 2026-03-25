package core

import (
	"bufio"
	"bytes"
	"context"
	stdjson "encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/goccy/go-json"
)

var ErrPlannerEndpointsUnavailable = errors.New("planner endpoints unavailable")

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type ToolCall struct {
	ID       *string      `json:"id,omitempty"`
	Type     string       `json:"type,omitempty"`
	Function FunctionCall `json:"function"`
}

// StreamMessage represents a chunk of data from the stream
type StreamMessage struct {
	Type    string // "chunk" or "thinking"
	Content string
}

type ChatStreamResult struct {
	ToolCalls []ToolCall
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
	_, err := c.ChatStreamingWithToolCalls(ctx, messages, options, tokenChan)
	return err
}

// ChatStreamingWithToolCalls handles a streaming chat request and extracts any tool calls
// embedded in the generated assistant text.
func (c *StepbitCoreClient) ChatStreamingWithToolCalls(ctx context.Context, messages []Message, options ChatOptions, tokenChan chan<- StreamMessage) (ChatStreamResult, error) {
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
		return ChatStreamResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ChatStreamResult{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var contentBuffer strings.Builder
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
								return ChatStreamResult{}, ctx.Err()
							}
						}

						// 2. Handle Standard Content
						if content, ok := delta["content"].(string); ok && content != "" {
							contentBuffer.WriteString(content)
							select {
							case tokenChan <- StreamMessage{Type: "chunk", Content: content}:
							case <-ctx.Done():
								return ChatStreamResult{}, ctx.Err()
							}
						}
					}
				}
			}
		}
	}

	result := ChatStreamResult{}
	if toolCalls, _, ok := ExtractStreamingToolCalls(contentBuffer.String()); ok {
		result.ToolCalls = toolCalls
	}

	return result, nil
}

// ChatCompletion aggregates a non-streaming response using the chat streaming API.
func (c *StepbitCoreClient) ChatCompletion(ctx context.Context, messages []Message, options ChatOptions) (string, error) {
	tokenChan := make(chan StreamMessage, 128)
	errChan := make(chan error, 1)

	go func() {
		errChan <- c.ChatStreaming(ctx, messages, options, tokenChan)
		close(tokenChan)
	}()

	var builder strings.Builder
	for msg := range tokenChan {
		if msg.Type != "chunk" {
			continue
		}
		builder.WriteString(msg.Content)
	}

	if err := <-errChan; err != nil {
		return "", err
	}

	return strings.TrimSpace(builder.String()), nil
}

// GetMCPTools fetches the list of MCP tools from stepbit-core
func (c *StepbitCoreClient) GetMCPTools(ctx context.Context) ([]map[string]interface{}, error) {
	// Try the current core path first, then fall back to the legacy compatibility path.
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

func (c *StepbitCoreClient) GetMCPProviders(ctx context.Context) ([]map[string]interface{}, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodGet, "/v1/mcp/providers", nil)
	if err != nil {
		return []map[string]interface{}{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return []map[string]interface{}{}, fmt.Errorf("mcp providers request failed (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Providers []map[string]interface{} `json:"providers"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return []map[string]interface{}{}, err
	}

	return result.Providers, nil
}

func (c *StepbitCoreClient) UpdateMCPProviderState(ctx context.Context, name string, enabled bool) (map[string]interface{}, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, fmt.Sprintf("/v1/mcp/providers/%s/state", name), map[string]interface{}{
		"enabled": enabled,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("mcp provider state update failed (%d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// ExecuteReasoning executes a reasoning graph synchronously
func (c *StepbitCoreClient) ExecuteReasoning(ctx context.Context, graph interface{}) (map[string]interface{}, error) {
	// Try the current core path first.
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
	// Try the current core path first.
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

func (c *StepbitCoreClient) ExecutePipeline(ctx context.Context, payload interface{}) (map[string]interface{}, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/v1/pipelines/execute", payload)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pipeline execution failed (%d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *StepbitCoreClient) PlanGoal(ctx context.Context, payload interface{}) (map[string]interface{}, error) {
	return c.callPlannerEndpoint(ctx, []string{"/v1/goals/plan", "/v1/planner/plan"}, payload)
}

func (c *StepbitCoreClient) ReplanGoal(ctx context.Context, payload interface{}) (map[string]interface{}, error) {
	return c.callPlannerEndpoint(ctx, []string{"/v1/goals/replan", "/v1/planner/replan"}, payload)
}

func (c *StepbitCoreClient) callPlannerEndpoint(ctx context.Context, paths []string, payload interface{}) (map[string]interface{}, error) {
	var lastErr error
	for _, path := range paths {
		resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, path, payload)
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusMethodNotAllowed {
			resp.Body.Close()
			lastErr = ErrPlannerEndpointsUnavailable
			continue
		}

		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			body, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("planner request failed (%d): %s", resp.StatusCode, string(body))
		}

		var result map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return nil, err
		}
		return result, nil
	}

	if lastErr == nil {
		lastErr = ErrPlannerEndpointsUnavailable
	}
	return nil, lastErr
}

// CheckHealth verifies if stepbit-core is reachable
func (c *StepbitCoreClient) CheckHealth(ctx context.Context) (bool, string) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	// Try /ready first on modern cores, then /health as a broader compatibility fallback.
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

func (c *StepbitCoreClient) CheckReadiness(ctx context.Context) (bool, string) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/ready", nil)
	if err != nil {
		return false, fmt.Sprintf("failed to build readiness request: %v", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return false, fmt.Sprintf("stepbit-core readiness check failed: %v", err)
	}
	defer resp.Body.Close()

	var payload map[string]interface{}
	_ = stdjson.NewDecoder(resp.Body).Decode(&payload)

	if resp.StatusCode == http.StatusOK {
		return true, "stepbit-core is ready"
	}

	if reason, ok := payload["reason"].(string); ok && reason != "" {
		return false, reason
	}
	if status, ok := payload["status"].(string); ok && status != "" {
		return false, status
	}

	return false, fmt.Sprintf("readiness returned status %d", resp.StatusCode)
}

func (c *StepbitCoreClient) GetHealthReport(ctx context.Context) (CoreHealthReport, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/health", nil)
	if err != nil {
		return CoreHealthReport{}, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return CoreHealthReport{}, err
	}
	defer resp.Body.Close()

	var report CoreHealthReport
	if err := stdjson.NewDecoder(resp.Body).Decode(&report); err != nil {
		return CoreHealthReport{}, err
	}

	return report, nil
}

func (c *StepbitCoreClient) GetReadinessReport(ctx context.Context) (CoreReadinessReport, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/ready", nil)
	if err != nil {
		return CoreReadinessReport{}, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return CoreReadinessReport{}, err
	}
	defer resp.Body.Close()

	var report CoreReadinessReport
	if err := stdjson.NewDecoder(resp.Body).Decode(&report); err != nil {
		return CoreReadinessReport{}, err
	}

	return report, nil
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

func (c *StepbitCoreClient) GetMetricsSummary(ctx context.Context) (CoreMetricsSummary, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/metrics", nil)
	if err != nil {
		return CoreMetricsSummary{}, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return CoreMetricsSummary{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return CoreMetricsSummary{}, fmt.Errorf("metrics request failed (%d): %s", resp.StatusCode, string(body))
	}

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return CoreMetricsSummary{}, err
	}

	return parseMetricsSummary(string(content)), nil
}

func (c *StepbitCoreClient) GetCoreStatus(ctx context.Context) CoreStatus {
	status := CoreStatus{
		Online:          false,
		Ready:           false,
		Message:         "stepbit-core unreachable",
		ActiveModel:     c.DefaultModel,
		SupportedModels: []string{},
		Metrics:         CoreMetricsSummary{},
		Warnings:        []string{},
		Capabilities: CoreCapabilities{
			PlannerHTTP:     false,
			ReplanHTTP:      false,
			DistributedHTTP: false,
			MetricsHTTP:     false,
			MCPRegistryHTTP: true,
		},
	}

	online, healthMessage := c.CheckHealth(ctx)
	status.Online = online
	status.Message = healthMessage
	if !online {
		return status
	}

	ready, readyMessage := c.CheckReadiness(ctx)
	status.Ready = ready
	if ready {
		status.Message = "stepbit-core is ready"
	} else if readyMessage != "" {
		status.Message = readyMessage
	}

	if models, err := c.DiscoverModels(ctx); err == nil {
		status.SupportedModels = models
		if len(models) > 0 && status.ActiveModel == c.DefaultModel {
			status.ActiveModel = models[0]
		}
	}

	if metrics, err := c.GetMetricsSummary(ctx); err == nil {
		status.Metrics = metrics
		status.Capabilities.MetricsHTTP = true
	}

	if !status.Ready {
		status.Warnings = append(status.Warnings, "Core is reachable but not yet ready for full execution.")
	}
	if status.Metrics.TokenLatencyAvgMs > 500 {
		status.Warnings = append(status.Warnings, "Average token latency is elevated.")
	}
	if status.Metrics.ActiveSessions > 8 {
		status.Warnings = append(status.Warnings, "Active session count suggests runtime pressure.")
	}
	if status.Capabilities.MetricsHTTP && status.Metrics.RequestsTotal == 0 {
		status.Warnings = append(status.Warnings, "Metrics are available but no requests have been processed yet.")
	}

	return status
}

func (c *StepbitCoreClient) ExecuteMCPTool(ctx context.Context, tool string, input interface{}) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"question": fmt.Sprintf("Execute MCP tool %s and return the structured result.", tool),
		"pipeline": map[string]interface{}{
			"name":        "mcp_tool_playground",
			"rlm_enabled": false,
			"stages": []map[string]interface{}{
				{
					"stage_type": "mcp_tool_stage",
					"config": map[string]interface{}{
						"tool":  tool,
						"input": input,
					},
				},
			},
		},
	}

	return c.ExecutePipeline(ctx, payload)
}

func parseMetricsSummary(input string) CoreMetricsSummary {
	summary := CoreMetricsSummary{}
	lines := strings.Split(input, "\n")
	var latencySum float64
	var latencyCount float64

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) != 2 {
			continue
		}

		value, err := strconv.ParseFloat(fields[1], 64)
		if err != nil {
			continue
		}

		switch fields[0] {
		case "requests_total":
			summary.RequestsTotal = value
		case "tokens_generated_total":
			summary.TokensGenerated = value
		case "active_sessions":
			summary.ActiveSessions = value
		case "token_latency_ms_sum":
			latencySum = value
		case "token_latency_ms_count":
			latencyCount = value
		}
	}

	if latencyCount > 0 {
		summary.TokenLatencyAvgMs = latencySum / latencyCount
	}

	return summary
}

type CronRetryPolicy struct {
	MaxRetries uint32 `json:"max_retries"`
	BackoffMs  uint64 `json:"backoff_ms"`
}

type CronJob struct {
	ID            string           `json:"id"`
	Schedule      string           `json:"schedule"`
	ExecutionType string           `json:"execution_type"`
	Payload       interface{}      `json:"payload"`
	FailureCount  uint32           `json:"failure_count"`
	LastFailureAt *uint64          `json:"last_failure_at"`
	NextRetryAt   *uint64          `json:"next_retry_at"`
	LastRunAt     *uint64          `json:"last_run_at"`
	RetryPolicy   *CronRetryPolicy `json:"retry_policy,omitempty"`
}

type CreateCronJobRequest struct {
	ID            string           `json:"id"`
	Schedule      string           `json:"schedule"`
	ExecutionType string           `json:"execution_type"`
	Payload       interface{}      `json:"payload"`
	RetryPolicy   *CronRetryPolicy `json:"retry_policy,omitempty"`
}

type CoreMetricsSummary struct {
	RequestsTotal     float64 `json:"requests_total"`
	TokensGenerated   float64 `json:"tokens_generated_total"`
	ActiveSessions    float64 `json:"active_sessions"`
	TokenLatencyAvgMs float64 `json:"token_latency_avg_ms"`
}

type CoreCapabilities struct {
	PlannerHTTP     bool `json:"planner_http"`
	ReplanHTTP      bool `json:"replan_http"`
	DistributedHTTP bool `json:"distributed_http"`
	MetricsHTTP     bool `json:"metrics_http"`
	MCPRegistryHTTP bool `json:"mcp_registry_http"`
}

type CoreStatus struct {
	Online          bool               `json:"online"`
	Ready           bool               `json:"ready"`
	Message         string             `json:"message"`
	ActiveModel     string             `json:"active_model"`
	SupportedModels []string           `json:"supported_models"`
	Metrics         CoreMetricsSummary `json:"metrics"`
	Warnings        []string           `json:"warnings"`
	Capabilities    CoreCapabilities   `json:"capabilities"`
}

type CoreCheck struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail,omitempty"`
}

type CoreHealthReport struct {
	Status string      `json:"status"`
	OK     bool        `json:"ok"`
	Checks []CoreCheck `json:"checks"`
}

type CoreReadinessContext struct {
	StateDir             string `json:"state_dir"`
	CronDBPath           string `json:"cron_db_path"`
	EventsDBPath         string `json:"events_db_path"`
	ModelsOnDisk         int    `json:"models_on_disk"`
	LoadedModels         int    `json:"loaded_models"`
	MCPEnabled           int    `json:"mcp_enabled"`
	MCPInstalled         int    `json:"mcp_installed"`
	CronSchedulerRunning bool   `json:"cron_scheduler_running"`
}

type CoreReadinessReport struct {
	Status  string               `json:"status"`
	Ready   bool                 `json:"ready"`
	Reasons []string             `json:"reasons"`
	Checks  []CoreCheck          `json:"checks"`
	Context CoreReadinessContext `json:"context"`
}

type CoreTempRuntime struct {
	RegisteredResources int    `json:"registered_resources"`
	TotalSizeBytes      uint64 `json:"total_size_bytes"`
	PressureLevel       string `json:"pressure_level"`
	GlobalUsageBytes    uint64 `json:"global_usage_bytes"`
	GlobalUsageFiles    int    `json:"global_usage_files"`
	GlobalMaxBytes      uint64 `json:"global_max_bytes"`
	GlobalMaxFiles      int    `json:"global_max_files"`
	PerOwnerMaxBytes    uint64 `json:"per_owner_max_bytes"`
	PerOwnerMaxFiles    int    `json:"per_owner_max_files"`
}

type CoreSystemRuntime struct {
	StateDir              string          `json:"state_dir"`
	CronDBPath            string          `json:"cron_db_path"`
	EventsDBPath          string          `json:"events_db_path"`
	ModelsOnDisk          int             `json:"models_on_disk"`
	LoadedModels          int             `json:"loaded_models"`
	MCPProviders          int             `json:"mcp_providers"`
	InstalledMCPProviders int             `json:"installed_mcp_providers"`
	TriggerCount          int             `json:"trigger_count"`
	SchedulerActive       bool            `json:"scheduler_active"`
	Temp                  CoreTempRuntime `json:"temp"`
}

type CoreCronStatus struct {
	SchedulerRunning bool `json:"scheduler_running"`
	TotalJobs        int  `json:"total_jobs"`
	FailingJobs      int  `json:"failing_jobs"`
	RetryingJobs     int  `json:"retrying_jobs"`
}

type CoreRecentEvent struct {
	ID         string      `json:"id"`
	EventType  string      `json:"event_type"`
	Payload    interface{} `json:"payload"`
	Timestamp  string      `json:"timestamp"`
	SourceNode *string     `json:"source_node"`
}

type EventTrigger struct {
	ID        string      `json:"id"`
	EventType string      `json:"event_type"`
	Condition interface{} `json:"condition"`
	Action    interface{} `json:"action"`
}

func (c *StepbitCoreClient) ListCronJobs(ctx context.Context) ([]CronJob, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodGet, "/v1/cron/jobs", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list cron jobs failed (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Jobs []CronJob `json:"jobs"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Jobs, nil
}

func (c *StepbitCoreClient) CreateCronJob(ctx context.Context, reqBody CreateCronJobRequest) error {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/v1/cron/jobs", reqBody)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create cron job failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func (c *StepbitCoreClient) DeleteCronJob(ctx context.Context, id string) error {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodDelete, "/v1/cron/jobs/"+id, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete cron job failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func (c *StepbitCoreClient) TriggerCronJob(ctx context.Context, id string) error {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/v1/cron/jobs/"+id+"/trigger", map[string]interface{}{})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("trigger cron job failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func (c *StepbitCoreClient) ListTriggers(ctx context.Context) ([]EventTrigger, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodGet, "/v1/triggers", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list triggers failed (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Triggers []EventTrigger `json:"triggers"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Triggers, nil
}

func (c *StepbitCoreClient) CreateTrigger(ctx context.Context, payload interface{}) error {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/v1/triggers", payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create trigger failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func (c *StepbitCoreClient) DeleteTrigger(ctx context.Context, id string) error {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodDelete, "/v1/triggers/"+id, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete trigger failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func (c *StepbitCoreClient) PublishEvent(ctx context.Context, payload interface{}) error {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodPost, "/v1/events", payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("publish event failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func (c *StepbitCoreClient) GetSystemRuntime(ctx context.Context) (CoreSystemRuntime, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodGet, "/v1/system/runtime", nil)
	if err != nil {
		return CoreSystemRuntime{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return CoreSystemRuntime{}, fmt.Errorf("system runtime failed (%d): %s", resp.StatusCode, string(body))
	}

	var result CoreSystemRuntime
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return CoreSystemRuntime{}, err
	}

	return result, nil
}

func (c *StepbitCoreClient) GetCronStatus(ctx context.Context) (CoreCronStatus, error) {
	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodGet, "/v1/cron/status", nil)
	if err != nil {
		return CoreCronStatus{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return CoreCronStatus{}, fmt.Errorf("cron status failed (%d): %s", resp.StatusCode, string(body))
	}

	var result CoreCronStatus
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return CoreCronStatus{}, err
	}

	return result, nil
}

func (c *StepbitCoreClient) ListRecentEvents(ctx context.Context, limit int) ([]CoreRecentEvent, error) {
	path := "/v1/events/recent"
	if limit > 0 {
		path = fmt.Sprintf("%s?limit=%d", path, limit)
	}

	resp, err := c.DoAuthenticatedRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("recent events failed (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Events []CoreRecentEvent `json:"events"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Events, nil
}
