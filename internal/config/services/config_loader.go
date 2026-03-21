package services

import (
	"os"
	"stepbit-app/internal/config/models"

	"gopkg.in/yaml.v3"
)

func LoadConfig(path string) (*models.AppConfig, error) {
	config := &models.AppConfig{}

	// 1. Defaults
	config.Database.Path = "./chat.db"
	config.Server.Port = ":8080"
	config.Server.Key = "sk-dev-key-123"
	config.Providers.Ollama.URL = "http://localhost:11434"
	config.Providers.StepbitCore.URL = "http://localhost:3000"
	config.Skills.Dir = "./skills"

	// 2. Load YAML if exists
	if _, err := os.Stat(path); err == nil {
		data, err := os.ReadFile(path)
		if err == nil {
			yaml.Unmarshal(data, config)
		}
	}

	// 3. Environment Overrides
	if val := os.Getenv("STEPBIT_DATABASE_PATH"); val != "" {
		config.Database.Path = val
	}
	if val := os.Getenv("STEPBIT_API_KEY"); val != "" {
		config.Server.Key = val
	}
	if val := os.Getenv("STEPBIT_CORE_URL"); val != "" {
		config.Providers.StepbitCore.URL = val
	}
	if val := os.Getenv("OLLAMA_URL"); val != "" {
		config.Providers.Ollama.URL = val
	}
	if val := os.Getenv("STEPBIT_SKILLS_DIR"); val != "" {
		config.Skills.Dir = val
	}

	return config, nil
}
