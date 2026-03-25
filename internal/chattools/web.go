package chattools

import (
	"context"
	stdjson "encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

const defaultUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"

type SearchTool struct {
	client *http.Client
}

type ReadURLTool struct {
	client *http.Client
}

type ReadFullContentTool struct{}

func NewSearchTool() *SearchTool {
	return &SearchTool{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func NewReadURLTool() *ReadURLTool {
	return &ReadURLTool{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func NewReadFullContentTool() *ReadFullContentTool {
	return &ReadFullContentTool{}
}

func (t *SearchTool) Definition() ToolDefinition {
	return ToolDefinition{
		Name:        "internet_search",
		Description: "Search the internet for recent information and return top sources with cached IDs for follow-up reading.",
		Parameters:  `{"type":"object","properties":{"query":{"type":"string","description":"The search query to look up on the web."}},"required":["query"]}`,
	}
}

func (t *ReadURLTool) Definition() ToolDefinition {
	return ToolDefinition{
		Name:        "read_url",
		Description: "Fetch and read the full content of a webpage from a given URL.",
		Parameters:  `{"type":"object","properties":{"url":{"type":"string","description":"The exact URL of the webpage to read."}},"required":["url"]}`,
	}
}

func (t *ReadFullContentTool) Definition() ToolDefinition {
	return ToolDefinition{
		Name:        "read_full_content",
		Description: "Read the full content of a previously cached search result or document.",
		Parameters:  `{"type":"object","properties":{"source_id":{"type":"integer","description":"The ID of the source to read, as provided in search snippets."}},"required":["source_id"]}`,
	}
}

func (t *SearchTool) Call(ctx context.Context, arguments string, sessionID uuid.UUID, store ToolResultStore) (string, error) {
	var args struct {
		Query string `json:"query"`
	}
	if err := stdjson.Unmarshal([]byte(arguments), &args); err != nil {
		return "", fmt.Errorf("error parsing arguments: %w", err)
	}
	if strings.TrimSpace(args.Query) == "" {
		return "", fmt.Errorf("query is required")
	}

	urls, err := t.search(ctx, args.Query)
	if err != nil {
		return "", err
	}
	if len(urls) == 0 {
		return "No results found for that query.", nil
	}

	var builder strings.Builder
	builder.WriteString("Search results found. The full content was cached for follow-up reading with `read_full_content`.\n\n")

	for _, rawURL := range urls {
		content, err := fetchPageContent(ctx, t.client, rawURL)
		if err != nil {
			builder.WriteString(fmt.Sprintf("URL: %s\nError: %v\n\n", rawURL, err))
			continue
		}

		inserted, err := store.InsertToolResult(&ToolResultRecord{
			SessionID: sessionID,
			SourceURL: rawURL,
			Content:   content,
		})
		if err != nil {
			builder.WriteString(fmt.Sprintf("URL: %s\nSnippet:\n%s\n\n", rawURL, truncate(content, 1200)))
			continue
		}

		builder.WriteString(fmt.Sprintf("--- Source ID: %d ---\nURL: %s\nSnippet:\n%s\n", inserted.ID, rawURL, truncate(content, 1200)))
		if len(content) > 1200 {
			builder.WriteString("[... Content truncated. Use `read_full_content` for more ...]\n")
		}
		builder.WriteString("\n")
	}

	return builder.String(), nil
}

func (t *ReadURLTool) Call(ctx context.Context, arguments string, sessionID uuid.UUID, store ToolResultStore) (string, error) {
	var args struct {
		URL string `json:"url"`
	}
	if err := stdjson.Unmarshal([]byte(arguments), &args); err != nil {
		return "", fmt.Errorf("error parsing arguments: %w", err)
	}
	target := strings.TrimSpace(args.URL)
	if target == "" || !(strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://")) {
		return "", fmt.Errorf("invalid url %q", target)
	}

	content, err := fetchPageContent(ctx, t.client, target)
	if err != nil {
		return "", err
	}
	if _, err := store.InsertToolResult(&ToolResultRecord{
		SessionID: sessionID,
		SourceURL: target,
		Content:   content,
	}); err != nil {
		return content, nil
	}
	return content, nil
}

func (t *ReadFullContentTool) Call(ctx context.Context, arguments string, _ uuid.UUID, store ToolResultStore) (string, error) {
	_ = ctx
	var args struct {
		SourceID int64 `json:"source_id"`
	}
	if err := stdjson.Unmarshal([]byte(arguments), &args); err != nil {
		return "", fmt.Errorf("error parsing arguments: %w", err)
	}
	result, err := store.GetToolResult(args.SourceID)
	if err != nil {
		return "", fmt.Errorf("source %d not found in cache", args.SourceID)
	}
	return fmt.Sprintf("Source URL: %s\nFull Content:\n%s", result.SourceURL, result.Content), nil
}

func (t *SearchTool) search(ctx context.Context, query string) ([]string, error) {
	searchURL := "https://html.duckduckgo.com/html/?q=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, searchURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", defaultUserAgent)

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	matches := regexp.MustCompile(`(?i)<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"`).FindAllStringSubmatch(string(body), 10)
	results := make([]string, 0, len(matches))
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		resolved := decodeSearchHref(match[1])
		if resolved == "" || strings.Contains(resolved, "duckduckgo.com") || strings.HasPrefix(resolved, "/") {
			continue
		}
		results = append(results, resolved)
		if len(results) == 3 {
			break
		}
	}
	return results, nil
}

func decodeSearchHref(raw string) string {
	raw = html.UnescapeString(raw)
	if strings.Contains(raw, "uddg=") {
		parsed, err := url.Parse(raw)
		if err == nil {
			if value := parsed.Query().Get("uddg"); value != "" {
				if decoded, err := url.QueryUnescape(value); err == nil {
					return decoded
				}
				return value
			}
		}
	}
	return raw
}

func fetchPageContent(ctx context.Context, client *http.Client, target string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", defaultUserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("error fetching %s: %w", target, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("error fetching %s: status %d", target, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	text := sanitizeHTMLToText(string(body))
	if text == "" {
		return "", fmt.Errorf("empty content returned from %s", target)
	}
	return fmt.Sprintf("Source: %s\nContent:\n%s", target, text), nil
}

func sanitizeHTMLToText(input string) string {
	scriptRe := regexp.MustCompile(`(?is)<script.*?>.*?</script>`)
	styleRe := regexp.MustCompile(`(?is)<style.*?>.*?</style>`)
	tagRe := regexp.MustCompile(`(?s)<[^>]+>`)
	wsRe := regexp.MustCompile(`\s+`)

	clean := scriptRe.ReplaceAllString(input, " ")
	clean = styleRe.ReplaceAllString(clean, " ")
	clean = tagRe.ReplaceAllString(clean, " ")
	clean = html.UnescapeString(clean)
	clean = wsRe.ReplaceAllString(clean, " ")
	clean = strings.TrimSpace(clean)
	return truncate(clean, 4000)
}

func truncate(input string, max int) string {
	if len(input) <= max {
		return input
	}
	return input[:max]
}

func mustParseSourceID(value string) int64 {
	id, _ := strconv.ParseInt(value, 10, 64)
	return id
}
