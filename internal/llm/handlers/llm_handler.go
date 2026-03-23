package handlers

import (
	"bufio"
	"fmt"
	"github.com/gofiber/fiber/v2"
	"io"
	"mime"
	"os"
	"path/filepath"
	executionServices "stepbit-app/internal/execution/services"
	"stepbit-app/internal/llm/services"
	"strings"
)

type LlmHandler struct {
	llmService       *services.LlmService
	executionService *executionServices.ExecutionService
}

func NewLlmHandler(llmService *services.LlmService, executionService *executionServices.ExecutionService) *LlmHandler {
	return &LlmHandler{llmService: llmService, executionService: executionService}
}

func (h *LlmHandler) ListMCPTools(c *fiber.Ctx) error {
	tools, err := h.llmService.GetMCPTools(c.Context())
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tools)
}

func (h *LlmHandler) ListMCPProviders(c *fiber.Ctx) error {
	providers, err := h.llmService.GetMCPProviders(c.Context())
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(providers)
}

func (h *LlmHandler) ExecuteReasoning(c *fiber.Ctx) error {
	var graph interface{}
	if err := c.BodyParser(&graph); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := h.llmService.ExecuteReasoning(c.Context(), graph)
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Reasoning service unavailable. Ensure stepbit-core is running and reachable.",
			"details": err.Error(),
		})
	}
	return c.JSON(result)
}

func (h *LlmHandler) ExecuteMCPTool(c *fiber.Ctx) error {
	tool := c.Params("tool")
	if tool == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tool is required"})
	}

	var req struct {
		Input interface{} `json:"input"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Input == nil {
		req.Input = map[string]interface{}{}
	}

	runID, runInsertErr := h.executionService.InsertRun("mcp_tool", tool, "execute_mcp_tool", fiber.Map{
		"tool":  tool,
		"input": req.Input,
	})
	result, err := h.llmService.ExecuteMCPTool(c.Context(), tool, req.Input)
	if runInsertErr == nil {
		status := "completed"
		if err != nil {
			status = "failed"
		}
		_ = h.executionService.CompleteRun(runID, status, result, err)
	}
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(result)
}

func (h *LlmHandler) ExecuteReasoningStream(c *fiber.Ctx) error {
	var graph interface{}
	if err := c.BodyParser(&graph); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	body, err := h.llmService.ExecuteReasoningStream(c.Context(), graph)
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Reasoning stream unavailable. Ensure stepbit-core is running and reachable.",
			"details": err.Error(),
		})
	}
	defer body.Close()

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		reader := bufio.NewReader(body)
		for {
			line, err := reader.ReadBytes('\n')
			if err != nil {
				if err != io.EOF {
					fmt.Fprintf(w, "data: {\"type\":\"error\",\"error\":\"%v\"}\n\n", err)
				}
				w.Flush()
				break
			}
			w.Write(line)
			w.Flush()
		}
	})
	return nil
}

func (h *LlmHandler) GetCoreStatus(c *fiber.Ctx) error {
	return c.JSON(h.llmService.GetCoreStatus(c.Context()))
}

func (h *LlmHandler) GetArtifact(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "path is required"})
	}

	resolved, err := filepath.Abs(path)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid artifact path"})
	}
	if !isAllowedArtifactPath(resolved) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "artifact path is outside allowed locations"})
	}

	content, err := os.ReadFile(resolved)
	if err != nil {
		if os.IsNotExist(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "artifact not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(resolved)))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	c.Type(contentType)
	return c.Send(content)
}

func (h *LlmHandler) DeleteArtifact(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "path is required"})
	}

	resolved, err := filepath.Abs(path)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid artifact path"})
	}
	if !isAllowedArtifactPath(resolved) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "artifact path is outside allowed locations"})
	}

	target := resolved
	info, err := os.Stat(resolved)
	if err != nil {
		if os.IsNotExist(err) {
			return c.JSON(fiber.Map{"deleted": false, "path": resolved, "reason": "not_found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	if !info.IsDir() {
		target = filepath.Dir(resolved)
	}
	if !isAllowedArtifactPath(target) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "artifact parent is outside allowed locations"})
	}

	if err := os.RemoveAll(target); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"deleted": true, "path": target})
}

func isAllowedArtifactPath(path string) bool {
	cleaned := filepath.Clean(path)
	for _, root := range allowedArtifactRoots() {
		if root == "" {
			continue
		}
		rel, err := filepath.Rel(root, cleaned)
		if err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			return true
		}
	}
	return false
}

func allowedArtifactRoots() []string {
	roots := []string{
		filepath.Join(os.TempDir(), "stepbit-core", "quantlab"),
	}

	if cwd, err := os.Getwd(); err == nil {
		roots = append(roots, filepath.Join(cwd, "..", "quantlab", "outputs"))
		roots = append(roots, filepath.Join(cwd, "..", "quant_lab", "outputs"))
	}
	if envRoot := os.Getenv("STEPBIT_QUANTLAB_OUTPUT_ROOT"); envRoot != "" {
		roots = append(roots, envRoot)
	}

	resolved := make([]string, 0, len(roots))
	for _, root := range roots {
		if abs, err := filepath.Abs(root); err == nil {
			resolved = append(resolved, filepath.Clean(abs))
		}
	}
	return resolved
}
