package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	configModels "stepbit-app/internal/config/models"
	"stepbit-app/internal/core"
	"testing"
)

func TestConfigService(t *testing.T) {
	// Mock stepbit-core
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok"}`))
		} else if r.URL.Path == "/models" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"models":["test-model"]}`))
		}
	}))
	defer server.Close()

	appConfig := &configModels.AppConfig{}
	appConfig.Providers.Ollama.URL = "http://localhost:11434"
	appConfig.Providers.StepbitCore.URL = server.URL

	coreClient := core.NewStepbitCoreClient(server.URL, "test-key", "default-model")
	service := NewConfigService(coreClient, appConfig)

	// 1. Initial State (now empty until discovered)
	if service.GetActiveModel() != "" {
		t.Errorf("Expected empty initial model, got %s", service.GetActiveModel())
	}

	// 2. Set Active Provider
	service.SetActiveProvider("ollama")
	providers := service.ListProviders()
	found := false
	for _, p := range providers {
		if p["id"] == "ollama" && p["active"] == true {
			found = true
			break
		}
	}
	if !found {
		t.Error("Ollama provider should be active")
	}

	// 3. Set Active Model
	service.SetActiveModel("new-model")
	if service.GetActiveModel() != "new-model" {
		t.Errorf("Expected new-model, got %s", service.GetActiveModel())
	}

	// 4. Verify Active Provider
	ctx := context.Background()
	online, _ := service.VerifyActiveProvider(ctx)
	if !online {
		t.Error("Provider verification should be online (mocked)")
	}

	// 5. Get Active Provider Details
	details, err := service.GetActiveProvider(ctx)
	if err != nil {
		t.Fatalf("GetActiveProvider failed: %v", err)
	}
	if details["status"] != "online" {
		t.Errorf("Expected online status, got %v", details["status"])
	}
}
