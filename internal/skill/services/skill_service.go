package services

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"stepbit-app/internal/skill/models"
	"strings"
)

type SkillService struct {
	db *sql.DB
}

func NewSkillService(db *sql.DB) *SkillService {
	return &SkillService{db: db}
}

func (s *SkillService) InsertSkill(skill *models.Skill) (int64, error) {
	var id int64
	err := s.db.QueryRow(
		"INSERT INTO skills (name, content, tags, source_url) VALUES (?, ?, ?, ?) RETURNING id",
		skill.Name, skill.Content, skill.Tags, skill.SourceURL,
	).Scan(&id)
	return id, err
}

func (s *SkillService) ListSkills(limit, offset int) ([]models.Skill, error) {
	rows, err := s.db.Query("SELECT id, name, content, tags, source_url, created_at, updated_at FROM skills LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	skills := []models.Skill{}
	for rows.Next() {
		var sk models.Skill
		rows.Scan(&sk.ID, &sk.Name, &sk.Content, &sk.Tags, &sk.SourceURL, &sk.CreatedAt, &sk.UpdatedAt)
		skills = append(skills, sk)
	}
	return skills, nil
}

func (s *SkillService) GetSkill(id int64) (*models.Skill, error) {
	var sk models.Skill
	err := s.db.QueryRow(
		"SELECT id, name, content, tags, source_url, created_at, updated_at FROM skills WHERE id = ?",
		id,
	).Scan(&sk.ID, &sk.Name, &sk.Content, &sk.Tags, &sk.SourceURL, &sk.CreatedAt, &sk.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &sk, nil
}

func (s *SkillService) UpdateSkill(id int64, name *string, content *string, tags *string, sourceURL *string) error {
	var query strings.Builder
	query.WriteString("UPDATE skills SET updated_at = CURRENT_TIMESTAMP")
	args := []interface{}{}

	if name != nil {
		query.WriteString(", name = ?")
		args = append(args, *name)
	}
	if content != nil {
		query.WriteString(", content = ?")
		args = append(args, *content)
	}
	if tags != nil {
		query.WriteString(", tags = ?")
		args = append(args, *tags)
	}
	if sourceURL != nil {
		query.WriteString(", source_url = ?")
		args = append(args, *sourceURL)
	}

	query.WriteString(" WHERE id = ?")
	args = append(args, id)

	_, err := s.db.Exec(query.String(), args...)
	return err
}

func (s *SkillService) DeleteSkill(id int64) error {
	_, err := s.db.Exec("DELETE FROM skills WHERE id = ?", id)
	return err
}

func (s *SkillService) PreloadSkills(dir string) error {
	files, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	for _, f := range files {
		if f.IsDir() || filepath.Ext(f.Name()) != ".md" {
			continue
		}

		path := filepath.Join(dir, f.Name())
		content, err := os.ReadFile(path)
		if err != nil {
			log.Printf("Error reading skill file %s: %v", path, err)
			continue
		}

		name := strings.TrimSuffix(f.Name(), ".md")
		skill := &models.Skill{
			Name:    name,
			Content: string(content),
			Tags:    "default",
		}

		// Check if exists
		var exists bool
		s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM skills WHERE name = ?)", name).Scan(&exists)
		if !exists {
			s.db.Exec("INSERT INTO skills (name, content, tags) VALUES (?, ?, ?)",
				skill.Name, skill.Content, skill.Tags)
			log.Printf("Preloaded skill: %s", name)
		}
	}
	return nil
}
