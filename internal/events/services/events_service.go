package services

import (
	"context"
	"stepbit-app/internal/core"
	"stepbit-app/internal/events/models"
)

type EventsService struct {
	coreClient *core.StepbitCoreClient
}

func NewEventsService(coreClient *core.StepbitCoreClient) *EventsService {
	return &EventsService{coreClient: coreClient}
}

func (s *EventsService) ListTriggers(ctx context.Context) ([]models.Trigger, error) {
	triggers, err := s.coreClient.ListTriggers(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]models.Trigger, 0, len(triggers))
	for _, trigger := range triggers {
		result = append(result, models.Trigger{
			ID:        trigger.ID,
			EventType: trigger.EventType,
			Condition: trigger.Condition,
			Action:    trigger.Action,
		})
	}

	return result, nil
}

func (s *EventsService) CreateTrigger(ctx context.Context, req models.CreateTriggerRequest) error {
	return s.coreClient.CreateTrigger(ctx, req)
}

func (s *EventsService) DeleteTrigger(ctx context.Context, id string) error {
	return s.coreClient.DeleteTrigger(ctx, id)
}

func (s *EventsService) PublishEvent(ctx context.Context, req models.PublishEventRequest) error {
	return s.coreClient.PublishEvent(ctx, req)
}
