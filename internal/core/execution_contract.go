package core

import "fmt"

func NormalizeExecutionResult(result map[string]interface{}, pipeline interface{}) map[string]interface{} {
	if result == nil {
		result = map[string]interface{}{}
	}

	trace := toStringSlice(result["trace"])
	toolCalls := toInterfaceSlice(result["tool_calls"])
	intermediateResults := toInterfaceSlice(result["intermediate_results"])
	stageSummaries := buildStageSummaries(pipeline, trace, intermediateResults, result["error"])

	if _, ok := result["final_answer"]; !ok {
		result["final_answer"] = ""
	}

	result["trace"] = trace
	result["tool_calls"] = toolCalls
	result["intermediate_results"] = intermediateResults
	result["stage_summaries"] = stageSummaries
	result["runtime"] = map[string]interface{}{
		"trace_steps":               len(trace),
		"tool_call_count":           len(toolCalls),
		"intermediate_result_count": len(intermediateResults),
		"stage_count":               len(stageSummaries),
		"completed_stage_count":     countCompletedStages(stageSummaries),
	}

	return result
}

func buildStageSummaries(pipeline interface{}, trace []string, intermediateResults []interface{}, resultErr interface{}) []map[string]interface{} {
	pipelineMap, _ := pipeline.(map[string]interface{})
	stagesRaw, _ := pipelineMap["stages"].([]interface{})

	summaries := make([]map[string]interface{}, 0, len(stagesRaw))
	for idx, stageRaw := range stagesRaw {
		stage, _ := stageRaw.(map[string]interface{})
		stageType := fmt.Sprintf("%v", stage["stage_type"])
		config, _ := stage["config"].(map[string]interface{})

		status := "planned"
		if len(trace) > idx || len(intermediateResults) > idx {
			status = "completed"
		}
		if resultErr != nil && idx == len(stagesRaw)-1 {
			status = "failed"
		}

		summary := map[string]interface{}{
			"index":      idx + 1,
			"stage_type": stageType,
			"title":      describeStage(stageType, config),
			"status":     status,
		}
		if len(trace) > idx {
			summary["trace_excerpt"] = trace[idx]
		}
		if tool, ok := config["tool"].(string); ok && tool != "" {
			summary["tool"] = tool
		}

		summaries = append(summaries, summary)
	}

	return summaries
}

func describeStage(stageType string, config map[string]interface{}) string {
	switch stageType {
	case "mcp_tool_stage":
		if tool, ok := config["tool"].(string); ok && tool != "" {
			return fmt.Sprintf("Run MCP tool %s", tool)
		}
		return "Run MCP tool stage"
	case "verification_stage":
		if description, ok := config["description"].(string); ok && description != "" {
			return description
		}
		return "Verification stage"
	case "planner_stage":
		return "Planner stage"
	case "synthesis_stage":
		return "Synthesis stage"
	default:
		return stageType
	}
}

func countCompletedStages(summaries []map[string]interface{}) int {
	total := 0
	for _, stage := range summaries {
		if stage["status"] == "completed" {
			total++
		}
	}
	return total
}

func toStringSlice(value interface{}) []string {
	switch typed := value.(type) {
	case []string:
		return typed
	case []interface{}:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			out = append(out, fmt.Sprintf("%v", item))
		}
		return out
	default:
		return []string{}
	}
}

func toInterfaceSlice(value interface{}) []interface{} {
	switch typed := value.(type) {
	case []interface{}:
		return typed
	case []map[string]interface{}:
		out := make([]interface{}, 0, len(typed))
		for _, item := range typed {
			out = append(out, item)
		}
		return out
	default:
		return []interface{}{}
	}
}
