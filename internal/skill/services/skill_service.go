package services

import (
	"context"
	"database/sql"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"stepbit-app/internal/skill/models"
	"strings"
)

type SkillService struct {
	db         *sql.DB
	httpClient *http.Client
}

func NewSkillService(db *sql.DB) *SkillService {
	return &SkillService{
		db:         db,
		httpClient: &http.Client{},
	}
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

func (s *SkillService) FetchSkillFromURL(ctx context.Context, req models.FetchURLRequest) (*models.Skill, error) {
	targetURL := strings.TrimSpace(req.URL)
	name := strings.TrimSpace(req.Name)
	if targetURL == "" {
		return nil, fmt.Errorf("url is required")
	}
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("User-Agent", "stepbit-app/1.0")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("fetch failed with status %d", resp.StatusCode)
	}

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	content := string(rawBody)
	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(strings.ToLower(contentType), "text/html") {
		content = stripHTMLTags(content)
	}

	sourceURL := targetURL
	id, err := s.InsertSkill(&models.Skill{
		Name:      name,
		Content:   content,
		Tags:      req.Tags,
		SourceURL: &sourceURL,
	})
	if err != nil {
		return nil, err
	}

	return s.GetSkill(id)
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

func stripHTMLTags(input string) string {
	tagRe := regexp.MustCompile(`(?s)<[^>]+>`)
	wsRe := regexp.MustCompile(`\s+`)
	output := tagRe.ReplaceAllString(input, " ")
	output = html.UnescapeString(output)
	output = wsRe.ReplaceAllString(output, " ")
	return strings.TrimSpace(output)
}
