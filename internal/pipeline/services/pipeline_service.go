package services

import (
	"database/sql"
	"stepbit-app/internal/pipeline/models"

	"github.com/goccy/go-json"
)

type PipelineService struct {
	db *sql.DB
}

func NewPipelineService(db *sql.DB) *PipelineService {
	return &PipelineService{db: db}
}

func (s *PipelineService) InsertPipeline(pipeline *models.Pipeline) (int64, error) {
	defJSON, _ := json.Marshal(pipeline.Definition)
	var id int64
	err := s.db.QueryRow(
		"INSERT INTO pipelines (name, definition) VALUES (?, ?) RETURNING id",
		pipeline.Name, string(defJSON),
	).Scan(&id)
	return id, err
}

func (s *PipelineService) ListPipelines(limit, offset int) ([]models.Pipeline, error) {
	rows, err := s.db.Query("SELECT id, name, definition, created_at, updated_at FROM pipelines LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pipelines := []models.Pipeline{}
	for rows.Next() {
		var pl models.Pipeline
		err := rows.Scan(&pl.ID, &pl.Name, &pl.Definition, &pl.CreatedAt, &pl.UpdatedAt)
		if err != nil {
			return nil, err
		}
		pipelines = append(pipelines, pl)
	}
	return pipelines, nil
}

func (s *PipelineService) GetPipeline(id int64) (*models.Pipeline, error) {
	var pl models.Pipeline
	err := s.db.QueryRow(
		"SELECT id, name, definition, created_at, updated_at FROM pipelines WHERE id = ?",
		id,
	).Scan(&pl.ID, &pl.Name, &pl.Definition, &pl.CreatedAt, &pl.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &pl, nil
}

func (s *PipelineService) UpdatePipeline(id int64, pipeline *models.Pipeline) error {
	defJSON, _ := json.Marshal(pipeline.Definition)
	_, err := s.db.Exec(
		"UPDATE pipelines SET name = ?, definition = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		pipeline.Name, string(defJSON), id,
	)
	return err
}

func (s *PipelineService) DeletePipeline(id int64) error {
	_, err := s.db.Exec("DELETE FROM pipelines WHERE id = ?", id)
	return err
}
