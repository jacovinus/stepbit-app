package services

import (
	"os"
	"stepbit-app/internal/pipeline/models"
	"stepbit-app/internal/storage/duckdb"
	"testing"
)

func BenchmarkPipelineService_InsertPipeline(b *testing.B) {
	dbPath := "./bench_pipeline.db"
	db, _ := duckdb.NewConnection(dbPath)
	defer db.Close()
	defer os.Remove(dbPath)
	duckdb.InitSchema(db)

	service := NewPipelineService(db)
	pl := &models.Pipeline{
		Name: "Bench",
		Definition: map[string]interface{}{
			"type": "bench",
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.InsertPipeline(pl)
	}
}

func BenchmarkPipelineService_GetPipeline(b *testing.B) {
	dbPath := "./bench_pipeline_get.db"
	db, _ := duckdb.NewConnection(dbPath)
	defer db.Close()
	defer os.Remove(dbPath)
	duckdb.InitSchema(db)

	service := NewPipelineService(db)
	id, _ := service.InsertPipeline(&models.Pipeline{Name: "Bench"})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.GetPipeline(id)
	}
}
