package main

import (
	"log"
	"os"
	"stepbit-app/internal/api"
	"stepbit-app/internal/core"
	"stepbit-app/internal/db"

	"github.com/joho/godotenv"
)

func main() {
	// 1. Load configuration (from .env or ENV)
	godotenv.Load()

	dbPath := os.Getenv("STEPBIT_DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./chat.db"
	}

	coreURL := os.Getenv("STEPBIT_CORE_URL")
	if coreURL == "" {
		coreURL = "http://localhost:3000"
	}

	apiKey := os.Getenv("STEPBIT_API_KEY")
	if apiKey == "" {
		apiKey = "sk-dev-key-123"
	}

	skillsDir := os.Getenv("STEPBIT_SKILLS_DIR")
	if skillsDir == "" {
		skillsDir = "./skills"
	}

	// 2. Initialize Services
	database, err := db.NewDbService(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	if err := database.PreloadSkillsFromDir(skillsDir); err != nil {
		log.Printf("Warning: Skill preloading failed: %v", err)
	}

	coreClient := core.NewStepbitCoreClient(coreURL, apiKey, "mistral-7b")

	// 3. Setup Router and Start Server
	router := api.NewRouter(coreClient, database, apiKey)

	log.Printf("Stepbit-App (Go) listening on :8080")
	log.Fatal(router.App.Listen(":8080"))
}
