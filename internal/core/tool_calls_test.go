package core

import "testing"

func TestExtractStreamingToolCalls_Simple(t *testing.T) {
	text := "Searching now...\n\n[{\"name\":\"internet_search\",\"arguments\":{\"query\":\"rust actix\"}}]"
	toolCalls, textBefore, ok := ExtractStreamingToolCalls(text)
	if !ok {
		t.Fatal("expected tool calls to be extracted")
	}
	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(toolCalls))
	}
	if toolCalls[0].Function.Name != "internet_search" {
		t.Fatalf("expected internet_search, got %q", toolCalls[0].Function.Name)
	}
	if toolCalls[0].Function.Arguments != "{\"query\":\"rust actix\"}" {
		t.Fatalf("unexpected arguments: %s", toolCalls[0].Function.Arguments)
	}
	if textBefore != "Searching now..." {
		t.Fatalf("unexpected preamble: %q", textBefore)
	}
}

func TestExtractStreamingToolCalls_WithFunctionWrapper(t *testing.T) {
	text := "Need to inspect this.\n[{\"type\":\"function\",\"function\":{\"name\":\"read_url\",\"arguments\":\"{\\\"url\\\":\\\"https://example.com\\\"}\"}}]"
	toolCalls, textBefore, ok := ExtractStreamingToolCalls(text)
	if !ok {
		t.Fatal("expected wrapped tool call to be extracted")
	}
	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(toolCalls))
	}
	if toolCalls[0].Function.Name != "read_url" {
		t.Fatalf("expected read_url, got %q", toolCalls[0].Function.Name)
	}
	if textBefore != "Need to inspect this." {
		t.Fatalf("unexpected preamble: %q", textBefore)
	}
}

func TestExtractStreamingToolCalls_IgnoresIncompleteJSON(t *testing.T) {
	text := "Searching...\n[{\"name\":\"internet_search\",\"arguments\":{\"query\":\"missing bracket\"}"
	if _, _, ok := ExtractStreamingToolCalls(text); ok {
		t.Fatal("expected incomplete JSON to be ignored")
	}
}

func TestExtractStreamingToolCalls_NormalizesSchemaLikeArguments(t *testing.T) {
	text := "I will search.\n[{\"name\":\"internet_search\",\"arguments\":{\"type\":\"object\",\"properties\":{\"query\":{\"type\":\"string\",\"description\":\"Search query\",\"value\":\"current time and date\"}}}}]"
	toolCalls, _, ok := ExtractStreamingToolCalls(text)
	if !ok {
		t.Fatal("expected tool calls to be extracted")
	}
	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(toolCalls))
	}
	if toolCalls[0].Function.Arguments != "{\"query\":\"current time and date\"}" {
		t.Fatalf("unexpected normalized arguments: %s", toolCalls[0].Function.Arguments)
	}
}

func TestExtractStreamingToolCalls_SupportsStringifiedObjectPayload(t *testing.T) {
	text := "[\"{\\\"internet_search\\\":{\\\"arguments\\\":{\\\"query\\\":\\\"current date and time\\\"}}}\"]"
	toolCalls, _, ok := ExtractStreamingToolCalls(text)
	if !ok {
		t.Fatal("expected tool calls to be extracted")
	}
	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(toolCalls))
	}
	if toolCalls[0].Function.Name != "internet_search" {
		t.Fatalf("expected internet_search, got %q", toolCalls[0].Function.Name)
	}
	if toolCalls[0].Function.Arguments != "{\"query\":\"current date and time\"}" {
		t.Fatalf("unexpected arguments: %s", toolCalls[0].Function.Arguments)
	}
}

func TestExtractStreamingToolCalls_SupportsToolNameAsObjectKey(t *testing.T) {
	text := "[{\"internet_search\":{\"arguments\":{\"query\":\"today's date and current time\"}}}]"
	toolCalls, _, ok := ExtractStreamingToolCalls(text)
	if !ok {
		t.Fatal("expected tool calls to be extracted")
	}
	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(toolCalls))
	}
	if toolCalls[0].Function.Name != "internet_search" {
		t.Fatalf("expected internet_search, got %q", toolCalls[0].Function.Name)
	}
	if toolCalls[0].Function.Arguments != "{\"query\":\"today's date and current time\"}" {
		t.Fatalf("unexpected arguments: %s", toolCalls[0].Function.Arguments)
	}
}
