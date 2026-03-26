package core

type TurnCapabilityTool struct {
	Name       string   `json:"name"`
	ProviderID string   `json:"provider_id"`
	Enabled    bool     `json:"enabled"`
	ReadOnly   bool     `json:"read_only"`
	OpenWorld  bool     `json:"open_world"`
	Tags       []string `json:"tags"`
}

type TurnCapabilityContext struct {
	SearchEnabled  bool                 `json:"search_enabled"`
	ReasonEnabled  bool                 `json:"reason_enabled"`
	RequestedTools []string             `json:"requested_tools"`
	AvailableTools []TurnCapabilityTool `json:"available_tools"`
	UsedTools      []string             `json:"used_tools"`
}
