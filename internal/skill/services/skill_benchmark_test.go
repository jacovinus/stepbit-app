package services

import (
	"fmt"
	"os"
	"stepbit-app/internal/skill/models"
	"stepbit-app/internal/storage/duckdb"
	"testing"
)

func BenchmarkSkillService_InsertSkill(b *testing.B) {
	dbPath := "./bench_skill.db"
	db, _ := duckdb.NewConnection(dbPath)
	defer db.Close()
	defer os.Remove(dbPath)
	duckdb.InitSchema(db)

	service := NewSkillService(db)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		skill := &models.Skill{
			Name:    fmt.Sprintf("Bench-%d", i),
			Content: "Benchmark skill content",
			Tags:    "bench",
		}
		service.InsertSkill(skill)
	}
}

func BenchmarkSkillService_GetSkill(b *testing.B) {
	dbPath := "./bench_skill_get.db"
	db, _ := duckdb.NewConnection(dbPath)
	defer db.Close()
	defer os.Remove(dbPath)
	duckdb.InitSchema(db)

	service := NewSkillService(db)
	id, _ := service.InsertSkill(&models.Skill{Name: "Bench", Content: "Content"})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.GetSkill(id)
	}
}
