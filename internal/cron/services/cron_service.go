package services

import (
	"context"
	"stepbit-app/internal/core"
	"stepbit-app/internal/cron/models"
)

type CronService struct {
	coreClient *core.StepbitCoreClient
}

func NewCronService(coreClient *core.StepbitCoreClient) *CronService {
	return &CronService{coreClient: coreClient}
}

func (s *CronService) ListCronJobs(ctx context.Context) ([]models.CronJob, error) {
	jobs, err := s.coreClient.ListCronJobs(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]models.CronJob, 0, len(jobs))
	for _, job := range jobs {
		result = append(result, models.CronJob{
			ID:            job.ID,
			Schedule:      job.Schedule,
			ExecutionType: job.ExecutionType,
			Payload:       job.Payload,
			FailureCount:  job.FailureCount,
			LastFailureAt: job.LastFailureAt,
			NextRetryAt:   job.NextRetryAt,
			LastRunAt:     job.LastRunAt,
			RetryPolicy:   convertRetryPolicy(job.RetryPolicy),
		})
	}

	return result, nil
}

func (s *CronService) CreateCronJob(ctx context.Context, req models.CreateCronJobRequest) error {
	return s.coreClient.CreateCronJob(ctx, core.CreateCronJobRequest{
		ID:            req.ID,
		Schedule:      req.Schedule,
		ExecutionType: req.ExecutionType,
		Payload:       req.Payload,
		RetryPolicy:   convertCoreRetryPolicy(req.RetryPolicy),
	})
}

func (s *CronService) DeleteCronJob(ctx context.Context, id string) error {
	return s.coreClient.DeleteCronJob(ctx, id)
}

func (s *CronService) TriggerCronJob(ctx context.Context, id string) error {
	return s.coreClient.TriggerCronJob(ctx, id)
}

func convertRetryPolicy(policy *core.CronRetryPolicy) *models.RetryPolicy {
	if policy == nil {
		return nil
	}

	return &models.RetryPolicy{
		MaxRetries: policy.MaxRetries,
		BackoffMs:  policy.BackoffMs,
	}
}

func convertCoreRetryPolicy(policy *models.RetryPolicy) *core.CronRetryPolicy {
	if policy == nil {
		return nil
	}

	return &core.CronRetryPolicy{
		MaxRetries: policy.MaxRetries,
		BackoffMs:  policy.BackoffMs,
	}
}
