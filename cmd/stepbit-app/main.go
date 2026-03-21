package main

import (
	"log"
	"stepbit-app/internal/api"
	"stepbit-app/internal/config/services"
	"stepbit-app/internal/core"
	"stepbit-app/internal/db"

	"github.com/joho/godotenv"
)

func main() {
	// 1. Load configuration (from .env or ENV)
	godotenv.Load()
	
	config, err := services.LoadConfig("config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 2. Initialize Services
	database, err := db.NewDbService(config.Database.Path)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	if err := database.PreloadSkillsFromDir(config.Skills.Dir); err != nil {
		log.Printf("Warning: Skill preloading failed: %v", err)
	}

	coreClient := core.NewStepbitCoreClient(config.Providers.StepbitCore.URL, config.Server.Key, "mistral-7b")

	// 3. Setup Router and Start Server
	router := api.NewRouter(coreClient, database, config)

	log.Printf("Stepbit-App (Go) listening on %s", config.Server.Port)
	log.Fatal(router.App.Listen(config.Server.Port))
}
