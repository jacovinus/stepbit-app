package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"stepbit-app/internal/skill/models"
	"stepbit-app/internal/storage/duckdb"
	"testing"
)

func ptrString(v string) *string { return &v }

func TestSkillService_CRUD(t *testing.T) {
	dbPath := "./test_skill.db"
	defer os.Remove(dbPath)

	db, err := duckdb.NewConnection(dbPath)
	if err != nil {
		t.Fatalf("Failed to connect to duckdb: %v", err)
	}
	defer db.Close()
	duckdb.InitSchema(db)

	service := NewSkillService(db)

	// 1. Insert Skill
	skill := &models.Skill{
		Name:    "Test Skill",
		Content: "# Test Content",
		Tags:    "test,go",
	}

	id, err := service.InsertSkill(skill)
	if err != nil {
		t.Fatalf("InsertSkill failed: %v", err)
	}

	// 2. Get Skill
	got, err := service.GetSkill(id)
	if err != nil {
		t.Fatalf("GetSkill failed: %v", err)
	}
	if got.Name != "Test Skill" {
		t.Errorf("Expected name 'Test Skill', got '%s'", got.Name)
	}

	// 3. Update Skill
	newContent := "# Updated Content"
	err = service.UpdateSkill(id, nil, &newContent, nil, nil)
	if err != nil {
		t.Fatalf("UpdateSkill failed: %v", err)
	}

	updated, _ := service.GetSkill(id)
	if updated.Content != "# Updated Content" {
		t.Errorf("Expected updated content, got '%s'", updated.Content)
	}

	// 4. List Skills
	skills, err := service.ListSkills(10, 0)
	if err != nil {
		t.Fatalf("ListSkills failed: %v", err)
	}
	if len(skills) != 1 {
		t.Errorf("Expected 1 skill, got %d", len(skills))
	}

	// 5. Delete Skill
	if err := service.DeleteSkill(id); err != nil {
		t.Fatalf("DeleteSkill failed: %v", err)
	}
	_, err = service.GetSkill(id)
	if err == nil {
		t.Error("Expected error for deleted skill, got nil")
	}
}

func TestSkillService_Preload(t *testing.T) {
	dbPath := "./test_skill_preload.db"
	defer os.Remove(dbPath)

	db, _ := duckdb.NewConnection(dbPath)
	defer db.Close()
	duckdb.InitSchema(db)

	// Create a dummy skills directory
	skillsDir := "./test_skills_dir"
	os.MkdirAll(skillsDir, 0755)
	defer os.RemoveAll(skillsDir)

	skillFile := skillsDir + "/hello.md"
	os.WriteFile(skillFile, []byte("# Hello Skill\nTags: test\n---\nHello World"), 0644)

	service := NewSkillService(db)
	if err := service.PreloadSkills(skillsDir); err != nil {
		t.Fatalf("PreloadSkills failed: %v", err)
	}

	// Preload uses Name for checking existence, so we need to find it by name or list
	skills, _ := service.ListSkills(10, 0)
	found := false
	for _, s := range skills {
		if s.Name == "hello" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Preloaded skill 'hello' not found")
	}
}

func TestSkillService_FetchSkillFromURL(t *testing.T) {
	dbPath := "./test_skill_fetch_url.db"
	defer os.Remove(dbPath)

	db, err := duckdb.NewConnection(dbPath)
	if err != nil {
		t.Fatalf("Failed to connect to duckdb: %v", err)
	}
	defer db.Close()
	duckdb.InitSchema(db)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("<html><body><h1>Hello</h1><p>Imported skill</p></body></html>"))
	}))
	defer server.Close()

	service := NewSkillService(db)
	skill, err := service.FetchSkillFromURL(context.Background(), models.FetchURLRequest{
		URL:  server.URL,
		Name: "Imported Skill",
		Tags: "imported,test",
	})
	if err != nil {
		t.Fatalf("FetchSkillFromURL failed: %v", err)
	}

	if skill.Name != "Imported Skill" {
		t.Fatalf("unexpected skill name: %s", skill.Name)
	}
	if skill.SourceURL == nil || *skill.SourceURL != server.URL {
		t.Fatalf("unexpected source url: %#v", skill.SourceURL)
	}
	if skill.Content == "" || skill.Content == "<html><body><h1>Hello</h1><p>Imported skill</p></body></html>" {
		t.Fatalf("expected cleaned content, got %q", skill.Content)
	}
}
