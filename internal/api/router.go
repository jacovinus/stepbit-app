package api

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"stepbit-app/internal/core"
	"stepbit-app/internal/db"
	"stepbit-app/internal/models"
	"strings"
	"sync"
	"time"

	"github.com/goccy/go-json"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

type Router struct {
	App       *fiber.App
	Core      *core.StepbitCoreClient
	DB        *db.DbService
	MasterKey string
	Config    map[string]string

	// Provider State
	providerMu      sync.RWMutex
	activeProviderID string
	activeModelID    string
}

func NewRouter(coreClient *core.StepbitCoreClient, dbService *db.DbService, masterKey string) *Router {
	app := fiber.New(fiber.Config{
		JSONEncoder: json.Marshal,
		JSONDecoder: json.Unmarshal,
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, X-API-Key, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, PATCH, OPTIONS",
	}))

	r := &Router{
		App:              app,
		Core:             coreClient,
		DB:               dbService,
		MasterKey:        masterKey,
		activeProviderID: "stepbit-core",
		activeModelID:    coreClient.DefaultModel,
	}

	api := app.Group("/api", func(c *fiber.Ctx) error {
		// 1. Allow health check
		if c.Path() == "/api/health" {
			return c.Next()
		}
		// 2. Allow OPTIONS (CORS preflight)
		if c.Method() == "OPTIONS" {
			return c.Next()
		}
		// 4. Simple Header-based Auth
		key := c.Get("X-API-Key")
		if key == "" {
			authHeader := c.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				key = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if key == "" || key != masterKey {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
		}
		return c.Next()
	})
	
	// WebSocket Upgrade Middleware
	app.Use("/api/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// Legacy WebSocket route (match original Stepbit path)
	app.Get("/ws/chat/:session_id", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	}, websocket.New(r.handleWebSocket))

	// Health (JSON for frontend useHealthCheck)
	api.Get("/health", r.handleHealth)

	// Config (providers, models, active provider)
	config := api.Group("/config")
	config.Get("/providers", r.handleListProviders)
	config.Post("/active-provider", r.handleSetActiveProvider)
	config.Get("/active-provider", r.handleGetActiveProvider)
	config.Post("/active-provider/verify", r.handleVerifyProvider)
	config.Get("/active-model", r.handleGetActiveModel)
	config.Post("/active-model", r.handleSetActiveModel)

	// Sessions
	sessions := api.Group("/sessions")
	sessions.Post("/", r.handleCreateSession)
	sessions.Get("/", r.handleListSessions)
	sessions.Get("/stats", r.handleGetStats)
	sessions.Post("/import", r.handleImportSession)
	sessions.Get("/:id", r.handleGetSession)
	sessions.Patch("/:id", r.handleUpdateSession)
	sessions.Delete("/:id", r.handleDeleteSession)
	sessions.Delete("/", r.handlePurgeSessions)
	sessions.Get("/:id/messages", r.handleGetSessionMessages)
	sessions.Get("/:id/export", r.handleExportSession)
	api.Get("/ws/chat/:session_id", websocket.New(r.handleWebSocket))

	// Skills
	skills := api.Group("/skills")
	skills.Get("/", r.handleListSkills)
	skills.Post("/", r.handleCreateSkill)
	skills.Get("/:id", r.handleGetSkill)
	skills.Patch("/:id", r.handleUpdateSkill)
	skills.Delete("/:id", r.handleDeleteSkill)

	// Pipelines
	pipelines := api.Group("/pipelines")
	pipelines.Get("/", r.handleListPipelines)
	pipelines.Post("/", r.handleCreatePipeline)
	pipelines.Get("/:id", r.handleGetPipeline)
	pipelines.Patch("/:id", r.handleUpdatePipeline)
	pipelines.Delete("/:id", r.handleDeletePipeline)
	pipelines.Post("/:id/execute", r.handleExecutePipeline)

	// Utils
	api.Post("/query", r.handleQuerySQL)
	api.Post("/snapshot", r.handleCreateSnapshot)

	// LLM Proxy (stepbit-core passthrough)
	llm := api.Group("/llm")
	llm.Get("/mcp/tools", r.handleListMCPTools)
	llm.Post("/reasoning/execute", r.handleExecuteReasoning)
	llm.Post("/reasoning/execute/stream", r.handleExecuteReasoningStream)

	// stepbit-core status
	api.Get("/stepbit-core/status", r.handleStepbitCoreStatus)

	// OpenAI-compatible Chat
	v1 := api.Group("/v1")
	v1.Post("/chat/completions", r.handleChatCompletions)

	return r
}

func (r *Router) handleCreateSession(c *fiber.Ctx) error {
	var req models.CreateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	id := uuid.New()
	session := &models.Session{
		ID:        id,
		Name:      req.Name,
		Metadata:  req.Metadata,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := r.DB.InsertSession(session); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(session)
}

func (r *Router) handleListSessions(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 20)
	offset := c.QueryInt("offset", 0)

	sessions, err := r.DB.ListSessions(limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(sessions)
}

func (r *Router) handleGetSession(c *fiber.Ctx) error {
	id := c.Params("id")
	session, err := r.DB.GetSession(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
	}
	return c.JSON(session)
}

func (r *Router) handleUpdateSession(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.UpdateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	session, err := r.DB.UpdateSession(id, req.Name, req.Metadata)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(session)
}

func (r *Router) handleDeleteSession(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := r.DB.DeleteSession(id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (r *Router) handlePurgeSessions(c *fiber.Ctx) error {
	if err := r.DB.PurgeDatabase(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (r *Router) handleGetSessionMessages(c *fiber.Ctx) error {
	id := c.Params("id")
	limit := c.QueryInt("limit", 100)
	offset := c.QueryInt("offset", 0)

	messages, err := r.DB.GetMessages(id, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(messages)
}

// Skills Handlers
func (r *Router) handleListSkills(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 100)
	offset := c.QueryInt("offset", 0)

	skills, err := r.DB.ListSkills(limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(skills)
}

func (r *Router) handleCreateSkill(c *fiber.Ctx) error {
	var req models.CreateSkillRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	skill := &models.Skill{
		Name:      req.Name,
		Content:   req.Content,
		Tags:      req.Tags,
		SourceURL: req.SourceURL,
	}

	id, err := r.DB.InsertSkill(skill)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	
	newSkill, _ := r.DB.GetSkill(id)
	return c.Status(fiber.StatusCreated).JSON(newSkill)
}

func (r *Router) handleGetSkill(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	skill, err := r.DB.GetSkill(int64(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Skill not found"})
	}
	return c.JSON(skill)
}

func (r *Router) handleUpdateSkill(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var req models.UpdateSkillRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	skill, err := r.DB.GetSkill(int64(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Skill not found"})
	}

	if req.Name != nil {
		skill.Name = *req.Name
	}
	if req.Content != nil {
		skill.Content = *req.Content
	}
	if req.Tags != nil {
		skill.Tags = *req.Tags
	}
	if req.SourceURL != nil {
		skill.SourceURL = req.SourceURL
	}

	if err := r.DB.UpdateSkill(int64(id), skill); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	newSkill, _ := r.DB.GetSkill(int64(id))
	return c.JSON(newSkill)
}

func (r *Router) handleDeleteSkill(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	if err := r.DB.DeleteSkill(int64(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Pipeline Handlers
func (r *Router) handleListPipelines(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 100)
	offset := c.QueryInt("offset", 0)

	pipelines, err := r.DB.ListPipelines(limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(pipelines)
}

func (r *Router) handleCreatePipeline(c *fiber.Ctx) error {
	var req models.CreatePipelineRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	pipeline := &models.Pipeline{
		Name:       req.Name,
		Definition: req.Definition,
	}

	id, err := r.DB.InsertPipeline(pipeline)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	
	newPipeline, _ := r.DB.GetPipeline(id)
	return c.Status(fiber.StatusCreated).JSON(newPipeline)
}

func (r *Router) handleGetPipeline(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	pipeline, err := r.DB.GetPipeline(int64(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pipeline not found"})
	}
	return c.JSON(pipeline)
}

func (r *Router) handleUpdatePipeline(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var req models.UpdatePipelineRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	pipeline, err := r.DB.GetPipeline(int64(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pipeline not found"})
	}

	if req.Name != nil {
		pipeline.Name = *req.Name
	}
	if req.Definition != nil {
		pipeline.Definition = req.Definition
	}

	if err := r.DB.UpdatePipeline(int64(id), pipeline); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	newPipeline, _ := r.DB.GetPipeline(int64(id))
	return c.JSON(newPipeline)
}

func (r *Router) handleDeletePipeline(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	if err := r.DB.DeletePipeline(int64(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (r *Router) handleGetStats(c *fiber.Ctx) error {
	stats, err := r.DB.GetStats()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(stats)
}

func (r *Router) handleQuerySQL(c *fiber.Ctx) error {
	var req models.SqlQueryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	rows, err := r.DB.QueryRaw(req.SQL)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	var results []map[string]interface{}

	for rows.Next() {
		columns := make([]interface{}, len(cols))
		columnPointers := make([]interface{}, len(cols))
		for i := range columns {
			columnPointers[i] = &columns[i]
		}

		if err := rows.Scan(columnPointers...); err != nil {
			return err
		}

		m := make(map[string]interface{})
		for i, colName := range cols {
			val := columns[i]
			m[colName] = val
		}
		results = append(results, m)
	}

	return c.JSON(models.SqlQueryResponse{
		Columns: cols,
		Rows:    results,
	})
}

func (r *Router) handleExportSession(c *fiber.Ctx) error {
	id := c.Params("id")
	session, err := r.DB.GetSession(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
	}

	messages, err := r.DB.GetMessages(id, 1000, 0)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Session: %s\n", session.Name))
	sb.WriteString(fmt.Sprintf("ID: %s\n", session.ID))
	sb.WriteString(fmt.Sprintf("Created At: %s\n", session.CreatedAt))
	sb.WriteString("---\n")

	for _, m := range messages {
		sb.WriteString(fmt.Sprintf("[%s]: %s\n", strings.ToUpper(m.Role), m.Content))
		sb.WriteString("---\n")
	}

	c.Set("Content-Type", "text/plain")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"session_%s.txt\"", id))
	return c.SendString(sb.String())
}

func (r *Router) handleImportSession(c *fiber.Ctx) error {
	body := string(c.Body())
	lines := strings.Split(body, "\n")
	if len(lines) < 1 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid import format"})
	}

	name := "Imported Session"
	if strings.HasPrefix(lines[0], "Session: ") {
		name = strings.TrimPrefix(lines[0], "Session: ")
	}

	session := &models.Session{
		ID:        uuid.New(),
		Name:      name,
		Metadata:  make(map[string]interface{}),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := r.DB.InsertSession(session); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var currentRole string
	var currentContent strings.Builder

	for _, line := range lines[1:] {
		if line == "---" {
			if currentRole != "" && currentContent.Len() > 0 {
				r.DB.InsertMessage(&models.Message{
					SessionID: session.ID,
					Role:      strings.ToLower(currentRole),
					Content:   strings.TrimSpace(currentContent.String()),
					Metadata:  make(map[string]interface{}),
				})
				currentContent.Reset()
			}
		} else if strings.HasPrefix(line, "[") && strings.Contains(line, "]: ") {
			idx := strings.Index(line, "]: ")
			currentRole = line[1:idx]
			currentContent.WriteString(line[idx+3:])
		} else {
			currentContent.WriteString("\n")
			currentContent.WriteString(line)
		}
	}

	return c.Status(fiber.StatusCreated).JSON(session)
}

func (r *Router) handleWebSocket(c *websocket.Conn) {
	// Verify API Key
	token := c.Query("token")
	if token == "" {
		token = c.Query("api_key")
	}
	log.Printf("[WS] Connection attempt - token='%s', masterKey='%s'", token, r.MasterKey)
	if token == "" || token != r.MasterKey {
		log.Printf("[WS] Auth failed - token mismatch")
		c.WriteJSON(models.WsServerMessage{Type: "error", Content: "Unauthorized"})
		c.Close()
		return
	}
	log.Printf("[WS] Auth OK")

	sessionIDStr := c.Params("session_id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		c.WriteJSON(models.WsServerMessage{Type: "error", Content: "Invalid session ID"})
		c.Close()
		return
	}

	// Verify session exists
	if _, err := r.DB.GetSession(sessionIDStr); err != nil {
		c.WriteJSON(models.WsServerMessage{Type: "error", Content: "Session not found"})
		c.Close()
		return
	}

	var (
		mt     int
		msg    []byte
		cancel context.CancelFunc
		ctx    context.Context
	)

	for {
		if mt, msg, err = c.ReadMessage(); err != nil {
			if cancel != nil {
				cancel()
			}
			break
		}

		if mt != websocket.TextMessage {
			continue
		}

		var clientMsg models.WsClientMessage
		if err := json.Unmarshal(msg, &clientMsg); err != nil {
			log.Printf("[WS] Failed to parse message: %v, raw: %s", err, string(msg))
			c.WriteJSON(models.WsServerMessage{Type: "error", Content: "Invalid JSON"})
			continue
		}
		log.Printf("[WS] Received message type='%s' content='%s'", clientMsg.Type, clientMsg.Content)

		switch clientMsg.Type {
		case "message":
			if cancel != nil {
				cancel()
			}
			ctx, cancel = context.WithCancel(context.Background())
			go r.handleWsChatMessage(ctx, c, sessionID, clientMsg)

		case "cancel":
			if cancel != nil {
				cancel()
				c.WriteJSON(models.WsServerMessage{Type: "status", Content: "Process cancelled"})
				c.WriteJSON(models.WsServerMessage{Type: "done", Content: ""})
			}
		}
	}
}

func (r *Router) handleWsChatMessage(ctx context.Context, c *websocket.Conn, sessionID uuid.UUID, msg models.WsClientMessage) {
	log.Printf("[WS-Chat] Starting chat for session=%s content='%s'", sessionID, msg.Content)
	// 1. Initial Status
	c.WriteJSON(models.WsServerMessage{Type: "status", Content: "Thinking..."})

	// 2. Persist User Message
	r.DB.InsertMessage(&models.Message{
		SessionID: sessionID,
		Role:      "user",
		Content:   msg.Content,
		Metadata:  make(map[string]interface{}),
	})

	// 3. Fetch History for Context
	history, _ := r.DB.GetMessages(sessionID.String(), 50, 0)
	llmMsgs := make([]core.Message, len(history))
	for i, h := range history {
		llmMsgs[i] = core.Message{
			Role:    h.Role,
			Content: h.Content,
		}
	}

	// 4. Call Core for Streaming
	tokenChan := make(chan core.StreamMessage, 100)
	errChan := make(chan error, 1)

	search := false
	if msg.Search != nil {
		search = *msg.Search
	}
	reason := false
	if msg.Reason != nil {
		reason = *msg.Reason
	}

	go func() {
		log.Printf("[WS-Chat] Calling ChatStreaming with %d messages, model=%s", len(llmMsgs), r.Core.DefaultModel)
		errChan <- r.Core.ChatStreaming(ctx, llmMsgs, core.ChatOptions{
			Search: search,
			Reason: reason,
		}, tokenChan)
		close(tokenChan)
	}()

	var fullContent strings.Builder
	for msg := range tokenChan {
		if msg.Type == "thinking" {
			c.WriteJSON(models.WsServerMessage{Type: "status", Content: msg.Content})
			continue
		}
		
		fullContent.WriteString(msg.Content)
		c.WriteJSON(models.WsServerMessage{Type: "chunk", Content: msg.Content})
	}

	if err := <-errChan; err != nil {
		log.Printf("[WS-Chat] ChatStreaming error: %v", err)
		if ctx.Err() == nil { // Not cancelled
			c.WriteJSON(models.WsServerMessage{Type: "error", Content: err.Error()})
		}
	} else {
		log.Printf("[WS-Chat] Streaming complete, content length=%d", fullContent.Len())
		r.DB.InsertMessage(&models.Message{
			SessionID: sessionID,
			Role:      "assistant",
			Content:   fullContent.String(),
			Metadata:  make(map[string]interface{}),
		})
		c.WriteJSON(models.WsServerMessage{Type: "done", Content: ""})
	}
}

type ChatRequest struct {
	Model       string           `json:"model"`
	Messages    []core.Message   `json:"messages"`
	Stream      bool             `json:"stream"`
	Temperature float64          `json:"temperature"`
	MaxTokens   int              `json:"max_tokens"`
}

func (r *Router) handleChatCompletions(c *fiber.Ctx) error {
	var req ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	sessionIDStr := c.Get("X-Stepbit-Session-Id")
	var sessionID uuid.UUID
	if sessionIDStr != "" {
		sessionID, _ = uuid.Parse(sessionIDStr)
	}

	// Persist user message if session exists
	if sessionID != uuid.Nil {
		lastMsg := req.Messages[len(req.Messages)-1]
		if lastMsg.Role == "user" {
			r.DB.InsertMessage(&models.Message{
				SessionID: sessionID,
				Role:      "user",
				Content:   lastMsg.Content,
				Model:     &req.Model,
			})
		}
	}

	if req.Stream {
		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")
		c.Set("Transfer-Encoding", "chunked")

		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			tokenChan := make(chan core.StreamMessage, 100)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			go func() {
				err := r.Core.ChatStreaming(ctx, req.Messages, core.ChatOptions{
					Model:       req.Model,
					Temperature: req.Temperature,
					MaxTokens:   req.MaxTokens,
				}, tokenChan)
				if err != nil {
					fmt.Fprintf(w, "data: {\"error\": \"%v\"}\n\n", err)
					w.Flush()
				}
				close(tokenChan)
			}()

			id := fmt.Sprintf("chatcmpl-%s", uuid.New().String())
			var fullContent string

			for msg := range tokenChan {
				if msg.Type == "thinking" {
					// We can skip thinking tokens in OpenAI-compatible SSE for now 
					// or handle them as a specific field if required.
					continue
				}
				token := msg.Content
				fullContent += token
				chunk := map[string]interface{}{
					"id":      id,
					"object":  "chat.completion.chunk",
					"created": time.Now().Unix(),
					"model":   req.Model,
					"choices": []interface{}{
						map[string]interface{}{
							"index": 0,
							"delta": map[string]interface{}{
								"content": token,
							},
						},
					},
				}
				jsonBytes, _ := json.Marshal(chunk)
				fmt.Fprintf(w, "data: %s\n\n", string(jsonBytes))
				w.Flush()
			}

			// Persist assistant message
			if sessionID != uuid.Nil {
				r.DB.InsertMessage(&models.Message{
					SessionID: sessionID,
					Role:      "assistant",
					Content:   fullContent,
					Model:     &req.Model,
				})
			}

			fmt.Fprintf(w, "data: [DONE]\n\n")
			w.Flush()
		})
		return nil
	}

	// Non-streaming not implemented for brevity in this step, but follows similar logic
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "Non-streaming not implemented yet"})
}

func (r *Router) handleCreateSnapshot(c *fiber.Ctx) error {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Path == "" {
		req.Path = "/tmp/stepbit_chat_snapshot.db"
	}

	if err := r.DB.CreateSnapshot(req.Path); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "success", "path": req.Path})
}

// ─── LLM Proxy Handlers ──────────────────────────────────────────────────────

func (r *Router) handleListMCPTools(c *fiber.Ctx) error {
	tools, err := r.Core.GetMCPTools(c.Context())
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tools)
}

func (r *Router) handleExecuteReasoning(c *fiber.Ctx) error {
	var graph interface{}
	if err := c.BodyParser(&graph); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := r.Core.ExecuteReasoning(c.Context(), graph)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (r *Router) handleExecuteReasoningStream(c *fiber.Ctx) error {
	var graph interface{}
	if err := c.BodyParser(&graph); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	resp, err := r.Core.ExecuteReasoningStream(c.Context(), graph)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		reader := bufio.NewReader(resp.Body)
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

func (r *Router) handleStepbitCoreStatus(c *fiber.Ctx) error {
	online, message := r.Core.CheckHealth(c.Context())
	return c.JSON(fiber.Map{
		"online":  online,
		"message": message,
	})
}

// ─── Health Handler ──────────────────────────────────────────────────────────

func (r *Router) handleHealth(c *fiber.Ctx) error {
	dbStatus := "connected"
	if err := r.DB.Ping(); err != nil {
		dbStatus = "disconnected"
	}
	return c.JSON(fiber.Map{
		"api":      "connected",
		"database": dbStatus,
	})
}

// ─── Config Handlers ─────────────────────────────────────────────────────────

func (r *Router) handleListProviders(c *fiber.Ctx) error {
	r.providerMu.RLock()
	activeID := r.activeProviderID
	r.providerMu.RUnlock()

	providers := []fiber.Map{
		{
			"id":               "stepbit-core",
			"active":           activeID == "stepbit-core",
			"supported_models": []string{},
			"status":           "unverified",
		},
		{
			"id":               "ollama",
			"active":           activeID == "ollama",
			"supported_models": []string{},
			"status":           "unverified",
		},
		{
			"id":               "openai",
			"active":           activeID == "openai",
			"supported_models": []string{},
			"status":           "unverified",
		},
		{
			"id":               "copilot",
			"active":           activeID == "copilot",
			"supported_models": []string{},
			"status":           "unverified",
		},
	}
	return c.JSON(providers)
}

func (r *Router) handleSetActiveProvider(c *fiber.Ctx) error {
	var req struct {
		ProviderID string `json:"provider_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	r.providerMu.Lock()
	r.activeProviderID = req.ProviderID
	r.providerMu.Unlock()

	return c.JSON(fiber.Map{"status": "ok", "active_provider": req.ProviderID})
}

func (r *Router) handleGetActiveProvider(c *fiber.Ctx) error {
	r.providerMu.RLock()
	providerID := r.activeProviderID
	modelID := r.activeModelID
	r.providerMu.RUnlock()

	// Discover models from stepbit-core
	models, _ := r.Core.DiscoverModels(c.Context())

	// Check connectivity
	online, _ := r.Core.CheckHealth(c.Context())
	status := "offline"
	if online {
		status = "online"
	}

	return c.JSON(fiber.Map{
		"id":               providerID,
		"status":           status,
		"supported_models": models,
		"active_model":     modelID,
	})
}

func (r *Router) handleVerifyProvider(c *fiber.Ctx) error {
	online, errMsg := r.Core.CheckHealth(c.Context())
	if online {
		return c.JSON(fiber.Map{"status": "online"})
	}
	return c.JSON(fiber.Map{"status": "offline", "error": errMsg})
}

func (r *Router) handleGetActiveModel(c *fiber.Ctx) error {
	r.providerMu.RLock()
	modelID := r.activeModelID
	r.providerMu.RUnlock()

	return c.JSON(fiber.Map{"model_id": modelID})
}

func (r *Router) handleSetActiveModel(c *fiber.Ctx) error {
	var req struct {
		ModelID string `json:"model_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	r.providerMu.Lock()
	r.activeModelID = req.ModelID
	// Also update the core client's default model so chat uses it
	r.Core.DefaultModel = req.ModelID
	r.providerMu.Unlock()

	return c.JSON(fiber.Map{"status": "ok", "model_id": req.ModelID})
}

// ─── Pipeline Execute Handler ────────────────────────────────────────────────

func (r *Router) handleExecutePipeline(c *fiber.Ctx) error {
	id := c.Params("id")
	var idInt int64
	if _, err := fmt.Sscanf(id, "%d", &idInt); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid pipeline id"})
	}

	pipeline, err := r.DB.GetPipeline(idInt)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "pipeline not found"})
	}

	var input struct {
		Question string `json:"question"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// Build the execution payload with pipeline definition + question
	execPayload := map[string]interface{}{
		"pipeline":   pipeline.Definition,
		"question":   input.Question,
		"model":      r.Core.DefaultModel,
	}

	result, err := r.Core.ExecuteReasoning(c.Context(), execPayload)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(result)
}
