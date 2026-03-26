package services

import (
	"encoding/json"
	"stepbit-app/internal/skill/models"
	"strings"
)

func encodeSkillPolicy(policy *models.SkillPolicy) (string, error) {
	if policy == nil {
		return "{}", nil
	}
	if policy.Description == "" && len(policy.AllowedTools) == 0 && policy.CitationPolicy == "" && len(policy.PreferredOutputs) == 0 {
		return "{}", nil
	}

	payload, err := json.Marshal(policy)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func decodeSkillPolicy(raw string) *models.SkillPolicy {
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(raw) == "{}" {
		return nil
	}

	var policy models.SkillPolicy
	if err := json.Unmarshal([]byte(raw), &policy); err != nil {
		return nil
	}

	if policy.Description == "" && len(policy.AllowedTools) == 0 && policy.CitationPolicy == "" && len(policy.PreferredOutputs) == 0 {
		return nil
	}

	return &policy
}
