package models

type ExecuteGoalRequest struct {
	Goal       string `json:"goal"`
	RlmEnabled bool   `json:"rlm_enabled"`
}
