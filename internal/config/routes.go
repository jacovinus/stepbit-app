package config

import (
	"stepbit-app/internal/config/handlers"
	"stepbit-app/internal/config/services"
	configModels "stepbit-app/internal/config/models"
	"stepbit-app/internal/core"
	"github.com/gofiber/fiber/v2"
)

type ConfigModule struct {
	ConfigHandler *handlers.ConfigHandler
	ConfigService *services.ConfigService
}

func NewConfigModule(coreClient *core.StepbitCoreClient, appConfig *configModels.AppConfig) *ConfigModule {
	configService := services.NewConfigService(coreClient, appConfig)
	configHandler := handlers.NewConfigHandler(configService)

	return &ConfigModule{
		ConfigHandler: configHandler,
		ConfigService: configService,
	}
}

func (m *ConfigModule) RegisterRoutes(app *fiber.App) {
	config := app.Group("/api/config")

	config.Get("/providers", m.ConfigHandler.ListProviders)
	config.Post("/active-provider", m.ConfigHandler.SetActiveProvider)
	config.Get("/active-provider", m.ConfigHandler.GetActiveProvider)
	config.Post("/active-provider/verify", m.ConfigHandler.VerifyProvider)
	config.Get("/active-model", m.ConfigHandler.GetActiveModel)
	config.Post("/active-model", m.ConfigHandler.SetActiveModel)
}
