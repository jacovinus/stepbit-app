import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExecutionHistory from './ExecutionHistory';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/executions', () => ({
  executionsApi: {
    list: vi.fn(() =>
      Promise.resolve([
        {
          id: 1,
          source_type: 'pipeline',
          source_id: 'nightly_analysis',
          action_type: 'execute_pipeline',
          status: 'completed',
          request_payload: { question: 'Run nightly analysis' },
          response_payload: { final_answer: 'done' },
          error: null,
          created_at: '2026-03-23T10:00:00.000Z',
          completed_at: '2026-03-23T10:00:05.000Z',
        },
        {
          id: 2,
          source_type: 'cron_job',
          source_id: 'daily_digest',
          action_type: 'trigger_cron_job',
          status: 'failed',
          request_payload: { id: 'daily_digest' },
          response_payload: {},
          error: 'core timeout',
          created_at: '2026-03-23T11:00:00.000Z',
          completed_at: '2026-03-23T11:00:02.000Z',
        },
      ]),
    ),
  },
}));

describe('ExecutionHistory Page', () => {
  it('shows coverage and recent failures across surfaces', async () => {
    renderWithProviders(<ExecutionHistory />);

    expect(await screen.findByText('Surface Coverage')).toBeInTheDocument();
    expect(screen.getByText('Recent Failures')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'pipeline' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'cron_job' })).toBeInTheDocument();
    expect(screen.getAllByText('core timeout').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Open pipelines view' })).toBeInTheDocument();
  });
});
