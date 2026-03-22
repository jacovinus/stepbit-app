package models

type Trigger struct {
	ID        string      `json:"id"`
	EventType string      `json:"event_type"`
	Condition interface{} `json:"condition"`
	Action    interface{} `json:"action"`
}

type CreateTriggerRequest struct {
	ID        string      `json:"id"`
	EventType string      `json:"event_type"`
	Condition interface{} `json:"condition"`
	Action    interface{} `json:"action"`
}

type PublishEventRequest struct {
	EventType string      `json:"event_type"`
	Payload   interface{} `json:"payload"`
}
