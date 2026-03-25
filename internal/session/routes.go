package session

import (
	"database/sql"
	configModels "stepbit-app/internal/config/models"
	configServices "stepbit-app/internal/config/services"
	"stepbit-app/internal/core"
	"stepbit-app/internal/session/handlers"
	"stepbit-app/internal/session/services"
	skillServices "stepbit-app/internal/skill/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

type SessionModule struct {
	SessionHandler *handlers.SessionHandler
	ChatHandler    *handlers.ChatHandler
	SessionService *services.SessionService
	ChatService    *services.ChatService
}

func NewSessionModule(db *sql.DB, coreClient *core.StepbitCoreClient, configService *configServices.ConfigService, appConfig *configModels.AppConfig) *SessionModule {
	sessionService := services.NewSessionService(db)
	skillService := skillServices.NewSkillService(db)
	chatService := services.NewChatService(coreClient, sessionService, skillService, configService, appConfig)
	sessionHandler := handlers.NewSessionHandler(sessionService)
	chatHandler := handlers.NewChatHandler(chatService)

	return &SessionModule{
		SessionHandler: sessionHandler,
		ChatHandler:    chatHandler,
		SessionService: sessionService,
		ChatService:    chatService,
	}
}

func (m *SessionModule) RegisterRoutes(app *fiber.App) {
	api := app.Group("/api/sessions")

	api.Get("/stats", m.SessionHandler.GetStats)
	api.Post("/import", m.SessionHandler.ImportSession)
	api.Post("/purge", m.SessionHandler.PurgeChat)

	api.Get("/", m.SessionHandler.ListSessions)
	api.Post("/", m.SessionHandler.CreateSession)
	api.Get("/:id", m.SessionHandler.GetSession)
	api.Put("/:id", m.SessionHandler.UpdateSession)
	api.Delete("/:id", m.SessionHandler.DeleteSession)
	api.Delete("/", m.SessionHandler.PurgeChat)
	api.Get("/:id/messages", m.SessionHandler.GetMessages)
	api.Get("/:id/export", m.SessionHandler.ExportSession)

	// WebSocket
	app.Get("/api/ws/chat/:id", websocket.New(m.ChatHandler.HandleWebSocket))
}
