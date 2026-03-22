package models

type RetryPolicy struct {
	MaxRetries uint32 `json:"max_retries"`
	BackoffMs  uint64 `json:"backoff_ms"`
}

type CronJob struct {
	ID            string       `json:"id"`
	Schedule      string       `json:"schedule"`
	ExecutionType string       `json:"execution_type"`
	Payload       interface{}  `json:"payload"`
	FailureCount  uint32       `json:"failure_count"`
	LastFailureAt *uint64      `json:"last_failure_at"`
	NextRetryAt   *uint64      `json:"next_retry_at"`
	LastRunAt     *uint64      `json:"last_run_at"`
	RetryPolicy   *RetryPolicy `json:"retry_policy,omitempty"`
}

type CreateCronJobRequest struct {
	ID            string       `json:"id"`
	Schedule      string       `json:"schedule"`
	ExecutionType string       `json:"execution_type"`
	Payload       interface{}  `json:"payload"`
	RetryPolicy   *RetryPolicy `json:"retry_policy,omitempty"`
}
