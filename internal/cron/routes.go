package cron

import (
	"database/sql"
	"stepbit-app/internal/core"
	"stepbit-app/internal/cron/handlers"
	"stepbit-app/internal/cron/services"
	executionServices "stepbit-app/internal/execution/services"

	"github.com/gofiber/fiber/v2"
)

type CronModule struct {
	CronHandler *handlers.CronHandler
	CronService *services.CronService
}

func NewCronModule(db *sql.DB, coreClient *core.StepbitCoreClient) *CronModule {
	cronService := services.NewCronService(coreClient)
	executionService := executionServices.NewExecutionService(db)
	cronHandler := handlers.NewCronHandler(cronService, executionService)

	return &CronModule{
		CronHandler: cronHandler,
		CronService: cronService,
	}
}

func (m *CronModule) RegisterRoutes(app *fiber.App) {
	api := app.Group("/api/cron")

	api.Get("/jobs", m.CronHandler.ListCronJobs)
	api.Post("/jobs", m.CronHandler.CreateCronJob)
	api.Delete("/jobs/:id", m.CronHandler.DeleteCronJob)
	api.Post("/jobs/:id/trigger", m.CronHandler.TriggerCronJob)
}
