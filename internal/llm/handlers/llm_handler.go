package handlers

import (
	"bufio"
	"fmt"
	"github.com/gofiber/fiber/v2"
	"io"
	"stepbit-app/internal/llm/services"
)

type LlmHandler struct {
	llmService *services.LlmService
}

func NewLlmHandler(llmService *services.LlmService) *LlmHandler {
	return &LlmHandler{llmService: llmService}
}

func (h *LlmHandler) ListMCPTools(c *fiber.Ctx) error {
	tools, err := h.llmService.GetMCPTools(c.Context())
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tools)
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
