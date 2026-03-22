package events

import (
	"database/sql"
	"stepbit-app/internal/core"
	"stepbit-app/internal/events/handlers"
	"stepbit-app/internal/events/services"
	executionServices "stepbit-app/internal/execution/services"

	"github.com/gofiber/fiber/v2"
)

type EventsModule struct {
	EventsHandler *handlers.EventsHandler
	EventsService *services.EventsService
}

func NewEventsModule(db *sql.DB, coreClient *core.StepbitCoreClient) *EventsModule {
	eventsService := services.NewEventsService(coreClient)
	executionService := executionServices.NewExecutionService(db)
	eventsHandler := handlers.NewEventsHandler(eventsService, executionService)

	return &EventsModule{
		EventsHandler: eventsHandler,
		EventsService: eventsService,
	}
}

func (m *EventsModule) RegisterRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Get("/triggers", m.EventsHandler.ListTriggers)
	api.Post("/triggers", m.EventsHandler.CreateTrigger)
	api.Delete("/triggers/:id", m.EventsHandler.DeleteTrigger)
	api.Post("/events", m.EventsHandler.PublishEvent)
}
