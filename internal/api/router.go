package api

import (
	"bufio"
	"context"
	"fmt"
	"stepbit-app/internal/config"
	configModels "stepbit-app/internal/config/models"
	"stepbit-app/internal/core"
	"stepbit-app/internal/cron"
	"stepbit-app/internal/db"
	"stepbit-app/internal/events"
	"stepbit-app/internal/execution"
	"stepbit-app/internal/goals"
	"stepbit-app/internal/llm"
	"stepbit-app/internal/pipeline"
	"stepbit-app/internal/session"
	sessionModels "stepbit-app/internal/session/models"
	"stepbit-app/internal/skill"
	"stepbit-app/internal/storage"
	"strings"
	"time"

	"github.com/goccy/go-json"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

type Router struct {
	App      *fiber.App
	Core     *core.StepbitCoreClient
	DB       *db.DbService
	ConfigUI *config.ConfigModule
	Config   *configModels.AppConfig
}

func NewRouter(coreClient *core.StepbitCoreClient, dbService *db.DbService, appConfig *configModels.AppConfig) *Router {
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

	// Register Modules
	configModule := config.NewConfigModule(coreClient, appConfig)
	sessionModule := session.NewSessionModule(dbService.GetDB(), coreClient, configModule.ConfigService, appConfig)
	skillModule := skill.NewSkillModule(dbService.GetDB())
	pipelineModule := pipeline.NewPipelineModule(dbService.GetDB(), coreClient)
	cronModule := cron.NewCronModule(dbService.GetDB(), coreClient)
	eventsModule := events.NewEventsModule(dbService.GetDB(), coreClient)
	executionModule := execution.NewExecutionModule(dbService.GetDB())
	goalsModule := goals.NewGoalsModule(dbService.GetDB(), coreClient)
	storageModule := storage.NewStorageModule(dbService.GetDB())
	llmModule := llm.NewLlmModule(coreClient)

	r := &Router{
		App:      app,
		Core:     coreClient,
		DB:       dbService,
		ConfigUI: configModule,
		Config:   appConfig,
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

		if key == "" || key != appConfig.Server.Key {
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

	// Register Module Routes
	sessionModule.RegisterRoutes(app)
	skillModule.RegisterRoutes(app)
	pipelineModule.RegisterRoutes(app)
	cronModule.RegisterRoutes(app)
	eventsModule.RegisterRoutes(app)
	executionModule.RegisterRoutes(app)
	goalsModule.RegisterRoutes(app)
	storageModule.RegisterRoutes(app)
	llmModule.RegisterRoutes(app)
	configModule.RegisterRoutes(app)

	// Legacy WebSocket route (match original Stepbit path)
	app.Get("/ws/chat/:id", sessionModule.ChatHandler.WebSocketUpgrade())

	// Health (JSON for frontend useHealthCheck)
	api.Get("/health", r.handleHealth)

	// OpenAI-compatible Chat
	v1 := api.Group("/v1")
	v1.Post("/chat/completions", r.handleChatCompletions)

	return r
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

type ChatRequest struct {
	Model       string         `json:"model"`
	Messages    []core.Message `json:"messages"`
	Stream      bool           `json:"stream"`
	Temperature float64        `json:"temperature"`
	MaxTokens   int            `json:"max_tokens"`
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
			r.DB.InsertMessage(&sessionModels.Message{
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
				r.DB.InsertMessage(&sessionModels.Message{
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

	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "Non-streaming not implemented yet"})
}
