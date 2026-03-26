package services

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	skillModels "stepbit-app/internal/skill/models"
)

type chatSkillPolicy struct {
	Name              string
	Description       string
	AllowedTools      []string
	RequiresCitations bool
	PrefersTables     bool
	PrefersConcise    bool
}

func buildSkillPolicyPrompt(skills []skillModels.Skill) string {
	policies := extractSkillPolicies(skills)
	if len(policies) == 0 {
		return ""
	}

	var builder strings.Builder
	builder.WriteString("Active skill policies:\n")
	for _, policy := range policies {
		builder.WriteString(fmt.Sprintf("- %s", policy.Name))
		if policy.Description != "" {
			builder.WriteString(": " + policy.Description)
		}
		builder.WriteString(".\n")
		if len(policy.AllowedTools) > 0 {
			builder.WriteString(fmt.Sprintf("  Allowed tools: %s.\n", strings.Join(policy.AllowedTools, ", ")))
		}
		if policy.RequiresCitations {
			builder.WriteString("  Cite sources when tool-backed or web-backed facts are used.\n")
		}
		if policy.PrefersTables {
			builder.WriteString("  Use Markdown tables for comparisons, rankings, or structured lists.\n")
		}
		if policy.PrefersConcise {
			builder.WriteString("  Keep the final answer concise and synthesized.\n")
		}
	}
	builder.WriteString("Treat these skills as policy and style guidance only. Do not explain the skills to the user and do not spell out tool-call JSON.\n")
	return builder.String()
}

func extractSkillPolicies(skills []skillModels.Skill) []chatSkillPolicy {
	policies := make([]chatSkillPolicy, 0, len(skills))
	for _, skill := range skills {
		content := skill.Content
		lower := strings.ToLower(content)
		policy := chatSkillPolicy{
			Name:              skill.Name,
			Description:       extractSkillDescription(content),
			AllowedTools:      inferAllowedTools(content),
			RequiresCitations: strings.Contains(lower, "cite sources") || strings.Contains(lower, "citation"),
			PrefersTables:     strings.Contains(lower, "use tables") || strings.Contains(lower, "markdown table"),
			PrefersConcise:    strings.Contains(lower, "be concise") || strings.Contains(lower, "concise"),
		}
		if skill.Policy != nil {
			if skill.Policy.Description != "" {
				policy.Description = skill.Policy.Description
			}
			if len(skill.Policy.AllowedTools) > 0 {
				policy.AllowedTools = append([]string(nil), skill.Policy.AllowedTools...)
			}
			switch strings.ToLower(skill.Policy.CitationPolicy) {
			case "required", "tool_required", "always":
				policy.RequiresCitations = true
			}
			for _, output := range skill.Policy.PreferredOutputs {
				switch strings.ToLower(output) {
				case "table", "tables":
					policy.PrefersTables = true
				case "concise":
					policy.PrefersConcise = true
				}
			}
		}
		policies = append(policies, policy)
	}
	return policies
}

func extractSkillDescription(content string) string {
	descriptionRe := regexp.MustCompile(`(?m)^description:\s*(.+)\s*$`)
	if matches := descriptionRe.FindStringSubmatch(content); len(matches) == 2 {
		return strings.TrimSpace(matches[1])
	}

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
		}
	}
	return ""
}

func inferAllowedTools(content string) []string {
	knownTools := []string{
		"internet_search",
		"read_url",
		"read_full_content",
		"current_date",
		"current_time",
		"timezone_time",
	}

	var allowed []string
	for _, tool := range knownTools {
		if strings.Contains(content, "`"+tool+"`") || strings.Contains(content, tool) {
			allowed = append(allowed, tool)
		}
	}
	sort.Strings(allowed)
	return allowed
}
