package main

import (
	"log/slog"
	"os"
	"stepbit-app/internal/api"
	"stepbit-app/internal/config/services"
	"stepbit-app/internal/core"
	"stepbit-app/internal/db"
	skillServices "stepbit-app/internal/skill/services"

	"github.com/joho/godotenv"
)

func main() {
	// 0. Setup Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// 1. Load configuration (from .env or ENV)
	godotenv.Load()
	
	config, err := services.LoadConfig("config.yaml")
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	// 2. Initialize Services
	database, err := db.NewDbService(config.Database.Path)
	if err != nil {
		slog.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	// 3. Preload Skills
	skillService := skillServices.NewSkillService(database.GetDB())
	if err := skillService.PreloadSkills(config.Skills.Dir); err != nil {
		slog.Warn("Skill preloading failed", "error", err)
	}

	coreClient := core.NewStepbitCoreClient(config.Providers.StepbitCore.URL, config.Server.Key, "mistral-7b")

	// 4. Setup Router and Start Server
	router := api.NewRouter(coreClient, database, config)

	slog.Info("Stepbit-App (Go) listening", "port", config.Server.Port)
	if err := router.App.Listen(config.Server.Port); err != nil {
		slog.Error("Server shutdown with error", "error", err)
		os.Exit(1)
	}
}
