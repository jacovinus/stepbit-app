package services

import (
	"os"
	"stepbit-app/internal/pipeline/models"
	"stepbit-app/internal/storage/duckdb"
	"testing"
)

func TestPipelineService_CRUD(t *testing.T) {
	dbPath := "./test_pipeline.db"
	defer os.Remove(dbPath)

	db, err := duckdb.NewConnection(dbPath)
	if err != nil {
		t.Fatalf("Failed to connect to duckdb: %v", err)
	}
	defer db.Close()
	duckdb.InitSchema(db)

	service := NewPipelineService(db)

	// 1. Insert Pipeline
	pl := &models.Pipeline{
		Name: "Test Pipeline",
		Definition: map[string]interface{}{
			"steps": []string{"step1", "step2"},
		},
	}

	id, err := service.InsertPipeline(pl)
	if err != nil {
		t.Fatalf("InsertPipeline failed: %v", err)
	}

	// 2. Get Pipeline
	got, err := service.GetPipeline(id)
	if err != nil {
		t.Fatalf("GetPipeline failed: %v", err)
	}
	if got.Name != "Test Pipeline" {
		t.Errorf("Expected name 'Test Pipeline', got '%s'", got.Name)
	}
	if len(got.Definition["steps"].([]interface{})) != 2 {
		t.Errorf("Expected 2 steps in definition, got %d", len(got.Definition["steps"].([]interface{})))
	}

	// 3. Update Pipeline
	pl.Name = "Updated Pipeline"
	if err := service.UpdatePipeline(id, pl); err != nil {
		t.Fatalf("UpdatePipeline failed: %v", err)
	}
	
	updated, _ := service.GetPipeline(id)
	if updated.Name != "Updated Pipeline" {
		t.Errorf("Expected updated name, got '%s'", updated.Name)
	}

	// 4. List Pipelines
	pipelines, err := service.ListPipelines(10, 0)
	if err != nil {
		t.Fatalf("ListPipelines failed: %v", err)
	}
	if len(pipelines) != 1 {
		t.Errorf("Expected 1 pipeline, got %d", len(pipelines))
	}

	// 5. Delete Pipeline
	if err := service.DeletePipeline(id); err != nil {
		t.Fatalf("DeletePipeline failed: %v", err)
	}
	_, err = service.GetPipeline(id)
	if err == nil {
		t.Error("Expected error for deleted pipeline, got nil")
	}
}
