package services

import (
	"context"
	"encoding/json"
	"net/http"
	configModels "stepbit-app/internal/config/models"
	"stepbit-app/internal/core"
	"strings"
	"sync"
)

type ConfigService struct {
	coreClient       *core.StepbitCoreClient
	providerMu       sync.RWMutex
	activeProviderID string
	activeModelID    string
	config           *configModels.AppConfig
}

func NewConfigService(coreClient *core.StepbitCoreClient, config *configModels.AppConfig) *ConfigService {
	return &ConfigService{
		coreClient:       coreClient,
		activeProviderID: "stepbit-core",
		activeModelID:    "", // Let it be discovered
		config:           config,
	}
}

func (s *ConfigService) ListProviders() []map[string]interface{} {
	s.providerMu.RLock()
	activeID := s.activeProviderID
	s.providerMu.RUnlock()

	return []map[string]interface{}{
		{"id": "stepbit-core", "active": activeID == "stepbit-core", "supported_models": []string{}, "status": "online"},
		{"id": "ollama", "active": activeID == "ollama", "supported_models": []string{}, "status": "online"},
		{"id": "openai", "active": activeID == "openai", "supported_models": []string{}, "status": "online"},
		{"id": "copilot", "active": activeID == "copilot", "supported_models": []string{}, "status": "online"},
	}
}

func (s *ConfigService) SetActiveProvider(providerID string) {
	s.providerMu.Lock()
	s.activeProviderID = providerID
	s.providerMu.Unlock()
}

func (s *ConfigService) GetActiveProvider(ctx context.Context) (map[string]interface{}, error) {
	s.providerMu.RLock()
	providerID := s.activeProviderID
	activeModel := s.activeModelID
	s.providerMu.RUnlock()

	models := []string{}
	var online bool // Keep var online bool as it's assigned later with '='

	if providerID == "ollama" {
		models, online = s.discoverOllamaModels()
	} else if providerID == "stepbit-core" {
		models, _ = s.coreClient.DiscoverModels(ctx)
		online, _ = s.coreClient.CheckHealth(ctx)
	}

	status := "offline"
	if online {
		status = "online"
	}

	// Fallback to default if no active model set or if current one not in discovered list
	if activeModel == "" && len(models) > 0 {
		activeModel = models[0]
	}

	return map[string]interface{}{
		"id":               providerID,
		"status":           status,
		"supported_models": models,
		"active_model":     activeModel,
	}, nil
}

func (s *ConfigService) discoverOllamaModels() ([]string, bool) {
	// 1. Try Ollama local API
	url := strings.TrimSuffix(s.config.Providers.Ollama.URL, "/") + "/api/tags"
	resp, err := s.coreClient.GetClient().Get(url)
	if err != nil {
		return []string{}, false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return []string{}, false
	}

	var result struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return []string{}, false
	}

	models := make([]string, 0, len(result.Models))
	for _, m := range result.Models {
		models = append(models, m.Name)
	}
	return models, true
}

func (s *ConfigService) VerifyActiveProvider(ctx context.Context) (bool, string) {
	return s.coreClient.CheckHealth(ctx)
}

func (s *ConfigService) GetActiveModel() string {
	s.providerMu.RLock()
	defer s.providerMu.RUnlock()
	return s.activeModelID
}

func (s *ConfigService) SetActiveModel(modelID string) {
	s.providerMu.Lock()
	s.activeModelID = modelID
	s.coreClient.DefaultModel = modelID
	s.providerMu.Unlock()
}
