package core

import (
	stdjson "encoding/json"
	"strings"
)

// ExtractStreamingToolCalls scans generated text for a trailing JSON array of tool calls.
// It returns the parsed tool calls plus the text that appeared before the JSON array.
func ExtractStreamingToolCalls(buffer string) ([]ToolCall, string, bool) {
	searchStart := 0
	for {
		startPos := strings.Index(buffer[searchStart:], "[")
		if startPos == -1 {
			return nil, "", false
		}

		absoluteStart := searchStart + startPos
		jsonPart := buffer[absoluteStart:]

		bracketCount := 0
		endPos := -1
		inString := false
		escapeNext := false

		for i, r := range jsonPart {
			if escapeNext {
				escapeNext = false
				continue
			}

			switch r {
			case '\\':
				escapeNext = true
			case '"':
				inString = !inString
			case '[':
				if !inString {
					bracketCount++
				}
			case ']':
				if !inString {
					bracketCount--
					if bracketCount == 0 {
						endPos = i + 1
						break
					}
				}
			}
		}

		if endPos != -1 {
			potentialJSON := jsonPart[:endPos]
			var rawCalls []map[string]any
			if err := stdjson.Unmarshal([]byte(potentialJSON), &rawCalls); err == nil {
				toolCalls := make([]ToolCall, 0, len(rawCalls))
				for _, raw := range rawCalls {
					function := raw
					if nested, ok := raw["function"].(map[string]any); ok {
						function = nested
					}

					name, _ := function["name"].(string)
					if name == "" {
						continue
					}

					arguments := "{}"
					if rawArgs, ok := function["arguments"]; ok {
						switch typed := rawArgs.(type) {
						case string:
							arguments = typed
						default:
							normalized := normalizeToolArguments(typed)
							if data, err := stdjson.Marshal(normalized); err == nil {
								arguments = string(data)
							}
						}
					}

					var id *string
					if rawID, ok := raw["id"].(string); ok && rawID != "" {
						id = &rawID
					}

					callType := "function"
					if rawType, ok := raw["type"].(string); ok && rawType != "" {
						callType = rawType
					}

					toolCalls = append(toolCalls, ToolCall{
						ID:   id,
						Type: callType,
						Function: FunctionCall{
							Name:      name,
							Arguments: arguments,
						},
					})
				}

				if len(toolCalls) > 0 {
					return toolCalls, strings.TrimSpace(buffer[:absoluteStart]), true
				}
			}
		}

		searchStart = absoluteStart + 1
	}
}

func normalizeToolArguments(input any) any {
	switch typed := input.(type) {
	case map[string]any:
		if looksLikeSchemaArguments(typed) {
			properties, _ := typed["properties"].(map[string]any)
			normalized := make(map[string]any, len(properties))
			for key, rawProperty := range properties {
				if propertyMap, ok := rawProperty.(map[string]any); ok {
					if value, exists := propertyMap["value"]; exists {
						normalized[key] = normalizeToolArguments(value)
						continue
					}
					if value, exists := propertyMap["default"]; exists {
						normalized[key] = normalizeToolArguments(value)
						continue
					}
				}
			}
			if len(normalized) > 0 {
				return normalized
			}
		}

		normalized := make(map[string]any, len(typed))
		for key, value := range typed {
			normalized[key] = normalizeToolArguments(value)
		}
		return normalized
	case []any:
		normalized := make([]any, 0, len(typed))
		for _, value := range typed {
			normalized = append(normalized, normalizeToolArguments(value))
		}
		return normalized
	default:
		return input
	}
}

func looksLikeSchemaArguments(input map[string]any) bool {
	_, hasType := input["type"]
	_, hasProperties := input["properties"]
	return hasType && hasProperties
}
