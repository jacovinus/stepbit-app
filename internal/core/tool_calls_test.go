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
