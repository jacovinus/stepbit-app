import client from './client';

export interface RetryPolicy {
  max_retries: number;
  backoff_ms: number;
}

export interface CronJob {
  id: string;
  schedule: string;
  execution_type: string;
  payload: any;
  failure_count: number;
  last_failure_at: number | null;
  next_retry_at: number | null;
  last_run_at: number | null;
  retry_policy?: RetryPolicy | null;
}

export interface CreateCronJobRequest {
  id: string;
  schedule: string;
  execution_type: string;
  payload: any;
  retry_policy?: RetryPolicy | null;
}

export const cronApi = {
  list: async (): Promise<CronJob[]> => {
    const response = await client.get('/cron/jobs');
    return response.data.jobs;
  },

  create: async (job: CreateCronJobRequest): Promise<void> => {
    await client.post('/cron/jobs', job);
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/cron/jobs/${id}`);
  },

  trigger: async (id: string): Promise<void> => {
    await client.post(`/cron/jobs/${id}/trigger`);
  },
};
