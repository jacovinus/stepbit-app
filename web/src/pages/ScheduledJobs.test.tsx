import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ScheduledJobs from './ScheduledJobs';
import { renderWithProviders } from '../test/renderWithProviders';

const { createCronJobMock } = vi.hoisted(() => ({
  createCronJobMock: vi.fn(),
}));

vi.mock('../api/cron', () => ({
  cronApi: {
    list: vi.fn(() =>
      Promise.resolve([
        {
          id: 'nightly_analysis',
          schedule: '0 9 * * 1-5',
          execution_type: 'Pipeline',
          payload: { pipeline: { name: 'nightly_analysis' }, question: 'Run scheduled analysis' },
          failure_count: 1,
          last_failure_at: null,
          next_retry_at: 1711184400,
          last_run_at: 1711180800,
          retry_policy: { max_retries: 3, backoff_ms: 300000 },
        },
      ]),
    ),
    create: createCronJobMock,
    delete: vi.fn(),
    trigger: vi.fn(),
  },
}));

vi.mock('../api/executions', () => ({
  executionsApi: {
    list: vi.fn(() =>
      Promise.resolve([
        {
          id: 1,
          source_type: 'cron_job',
          source_id: 'nightly_analysis',
          action_type: 'trigger_cron_job',
          status: 'completed',
          request_payload: { id: 'nightly_analysis' },
          response_payload: { status: 'triggered' },
          error: null,
          created_at: '2026-03-23T10:00:00.000Z',
          completed_at: '2026-03-23T10:00:01.000Z',
        },
      ]),
    ),
  },
}));

vi.mock('../hooks/useStepbitCore', () => ({
  useStepbitCore: () => ({
    online: true,
    ready: true,
    message: 'ready',
    active_model: 'gpt-5.4',
    supported_models: ['gpt-5.4'],
    metrics: {
      requests_total: 1,
      tokens_generated_total: 2,
      active_sessions: 0,
      token_latency_avg_ms: 12,
    },
    warnings: [],
    capabilities: {
      planner_http: false,
      replan_http: false,
      distributed_http: false,
      metrics_http: true,
      mcp_registry_http: true,
    },
    loading: false,
    refresh: vi.fn(),
  }),
}));

describe('ScheduledJobs Page', () => {
  it('renders jobs and activity shortcuts', async () => {
    renderWithProviders(<ScheduledJobs />);

    expect((await screen.findAllByText('nightly_analysis')).length).toBeGreaterThan(0);
    expect(screen.getByText('Job Activity Feed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Execution History' })).toBeInTheDocument();
  });

  it('validates guided job creation before submitting', async () => {
    renderWithProviders(<ScheduledJobs />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create Scheduled Job' }));

    expect((await screen.findAllByText('Job ID is required.')).length).toBeGreaterThan(0);
    expect(createCronJobMock).not.toHaveBeenCalled();
  });
});
