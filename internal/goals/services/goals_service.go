package services

import (
	"fmt"
	"strings"
	"time"

	"stepbit-app/internal/goals/models"
)

type GoalsService struct{}

func NewGoalsService() *GoalsService {
	return &GoalsService{}
}

func (s *GoalsService) BuildExecutionPayload(req models.ExecuteGoalRequest) map[string]interface{} {
	goal := strings.TrimSpace(req.Goal)

	return map[string]interface{}{
		"question":    goal,
		"rlm_enabled": req.RlmEnabled,
		"pipeline": map[string]interface{}{
			"name":        "goal_mode_planner",
			"rlm_enabled": req.RlmEnabled,
			"stages": []map[string]interface{}{
				{
					"stage_type": "planner_stage",
					"config": map[string]interface{}{
						"goal": goal,
					},
				},
				{
					"stage_type": "synthesis_stage",
					"config":     map[string]interface{}{},
				},
			},
		},
	}
}

func (s *GoalsService) BuildSourceID(goal string) string {
	trimmed := strings.Join(strings.Fields(goal), " ")
	if trimmed == "" {
		return fmt.Sprintf("goal-%d", time.Now().Unix())
	}

	if len(trimmed) > 96 {
		return trimmed[:96]
	}

	return trimmed
}
