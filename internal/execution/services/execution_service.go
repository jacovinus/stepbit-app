package services

import (
	"database/sql"
	"fmt"
	"stepbit-app/internal/execution/models"

	"github.com/goccy/go-json"
)

type ExecutionService struct {
	db *sql.DB
}

func NewExecutionService(db *sql.DB) *ExecutionService {
	return &ExecutionService{db: db}
}

func (s *ExecutionService) InsertRun(sourceType, sourceID, actionType string, requestPayload any) (int64, error) {
	requestJSON, _ := json.Marshal(requestPayload)

	var id int64
	err := s.db.QueryRow(
		"INSERT INTO execution_runs (source_type, source_id, action_type, status, request_payload) VALUES (?, ?, ?, 'running', ?) RETURNING id",
		sourceType, sourceID, actionType, string(requestJSON),
	).Scan(&id)
	if err != nil {
		return 0, err
	}

	return id, nil
}

func (s *ExecutionService) CompleteRun(id int64, status string, responsePayload any, runErr error) error {
	responseJSON, _ := json.Marshal(responsePayload)

	var errMsg *string
	if runErr != nil {
		msg := runErr.Error()
		errMsg = &msg
	}

	_, err := s.db.Exec(
		"UPDATE execution_runs SET status = ?, response_payload = ?, error = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
		status, string(responseJSON), errMsg, id,
	)
	return err
}

func (s *ExecutionService) ListRuns(limit, offset int) ([]models.ExecutionRun, error) {
	rows, err := s.db.Query(
		`SELECT id, source_type, source_id, action_type, status,
		        CAST(request_payload AS VARCHAR), CAST(response_payload AS VARCHAR), error, created_at, completed_at
		   FROM execution_runs
		  ORDER BY created_at DESC
		  LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	runs := []models.ExecutionRun{}
	for rows.Next() {
		var run models.ExecutionRun
		var requestStr, responseStr string

		if err := rows.Scan(
			&run.ID, &run.SourceType, &run.SourceID, &run.ActionType, &run.Status,
			&requestStr, &responseStr, &run.Error, &run.CreatedAt, &run.CompletedAt,
		); err != nil {
			return nil, err
		}

		run.RequestPayload = decodeJSON(requestStr)
		run.ResponsePayload = decodeJSON(responseStr)
		runs = append(runs, run)
	}

	return runs, nil
}

func (s *ExecutionService) DeleteRun(id int64) error {
	_, err := s.db.Exec("DELETE FROM execution_runs WHERE id = ?", id)
	return err
}

func (s *ExecutionService) DeleteAllRuns() error {
	_, err := s.db.Exec("DELETE FROM execution_runs")
	return err
}

func decodeJSON(raw string) any {
	if raw == "" {
		return map[string]any{}
	}

	var decoded any
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		return map[string]any{"raw": raw, "error": fmt.Sprintf("decode failed: %v", err)}
	}

	return decoded
}
