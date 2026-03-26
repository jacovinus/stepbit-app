package services

import "stepbit-app/internal/core"

func structuredAssistantMetadata(result core.ChatStreamResult) map[string]interface{} {
	metadata := map[string]interface{}{
		"structured": true,
	}

	if len(result.ToolEvents) > 0 {
		metadata["tool_calls"] = result.ToolEvents
	}
	if result.TurnContext != nil {
		metadata["turn_context"] = result.TurnContext
	}

	return metadata
}
