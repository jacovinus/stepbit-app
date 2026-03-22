package services

import (
	"testing"

	"stepbit-app/internal/goals/models"
)

func TestBuildExecutionPayload(t *testing.T) {
	service := NewGoalsService()

	payload := service.BuildExecutionPayload(models.ExecuteGoalRequest{
		Goal:       "Investigate churn drivers in Q1",
		RlmEnabled: true,
	})

	if payload["question"] != "Investigate churn drivers in Q1" {
		t.Fatalf("unexpected question: %v", payload["question"])
	}

	if payload["rlm_enabled"] != true {
		t.Fatalf("expected rlm_enabled to be true")
	}

	pipeline, ok := payload["pipeline"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected pipeline map, got %T", payload["pipeline"])
	}

	stages, ok := pipeline["stages"].([]map[string]interface{})
	if !ok {
		t.Fatalf("expected typed stages slice, got %T", pipeline["stages"])
	}

	if len(stages) != 2 {
		t.Fatalf("expected 2 stages, got %d", len(stages))
	}

	if stages[0]["stage_type"] != "planner_stage" {
		t.Fatalf("unexpected first stage: %v", stages[0]["stage_type"])
	}

	if stages[1]["stage_type"] != "synthesis_stage" {
		t.Fatalf("unexpected second stage: %v", stages[1]["stage_type"])
	}
}

func TestBuildSourceIDTruncatesLongGoals(t *testing.T) {
	service := NewGoalsService()

	sourceID := service.BuildSourceID("This is a very long goal that should be truncated before it is stored in the execution history because source ids should stay readable and compact")

	if len(sourceID) > 96 {
		t.Fatalf("expected source id length <= 96, got %d", len(sourceID))
	}
}
