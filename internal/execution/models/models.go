package models

import "time"

type ExecutionRun struct {
	ID              int64      `json:"id"`
	SourceType      string     `json:"source_type"`
	SourceID        string     `json:"source_id"`
	ActionType      string     `json:"action_type"`
	Status          string     `json:"status"`
	RequestPayload  any        `json:"request_payload"`
	ResponsePayload any        `json:"response_payload"`
	Error           *string    `json:"error"`
	CreatedAt       time.Time  `json:"created_at"`
	CompletedAt     *time.Time `json:"completed_at"`
}
