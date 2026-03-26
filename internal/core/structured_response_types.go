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

type StructuredCitation struct {
	SourceID string `json:"source_id"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	Snippet  string `json:"snippet,omitempty"`
}

type StructuredArtifact struct {
	Family     string      `json:"family"`
	Title      string      `json:"title"`
	SourceTool string      `json:"source_tool"`
	Data       interface{} `json:"data"`
}

type StructuredContentItem struct {
	ContentType string              `json:"content_type"`
	Text        string              `json:"text"`
	Citation    *StructuredCitation `json:"citation,omitempty"`
	Artifact    *StructuredArtifact `json:"artifact,omitempty"`
}

type StructuredOutputItem struct {
	ID      string                  `json:"id"`
	ItemType string                 `json:"item_type"`
	Role    string                  `json:"role"`
	Content []StructuredContentItem `json:"content"`
	Status  string                  `json:"status"`
}
