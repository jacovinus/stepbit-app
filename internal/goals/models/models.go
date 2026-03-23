package models

type GoalPlanStage struct {
	ID        string                 `json:"id"`
	Title     string                 `json:"title"`
	StageType string                 `json:"stage_type"`
	Summary   string                 `json:"summary"`
	Config    map[string]interface{} `json:"config"`
}

type GoalPlan struct {
	PlannerSource string          `json:"planner_source"`
	PlannerMode   string          `json:"planner_mode"`
	Goal          string          `json:"goal"`
	PipelineName  string          `json:"pipeline_name"`
	Summary       string          `json:"summary"`
	Notes         []string        `json:"notes"`
	Stages        []GoalPlanStage `json:"stages"`
	Pipeline      map[string]any  `json:"pipeline"`
}

type PlanGoalRequest struct {
	Goal       string `json:"goal"`
	RlmEnabled bool   `json:"rlm_enabled"`
}

type ExecuteGoalRequest struct {
	Goal       string    `json:"goal"`
	RlmEnabled bool      `json:"rlm_enabled"`
	Plan       *GoalPlan `json:"plan,omitempty"`
}

type ReplanGoalRequest struct {
	Goal          string         `json:"goal"`
	RlmEnabled    bool           `json:"rlm_enabled"`
	FailureReason string         `json:"failure_reason"`
	PreviousPlan  *GoalPlan      `json:"previous_plan"`
	LastResult    map[string]any `json:"last_result,omitempty"`
}
