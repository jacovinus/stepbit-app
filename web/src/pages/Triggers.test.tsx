import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Triggers from './Triggers';
import { renderWithProviders } from '../test/renderWithProviders';

const { createTriggerMock } = vi.hoisted(() => ({
  createTriggerMock: vi.fn(() => Promise.resolve()),
}));

vi.mock('../api/events', () => ({
  eventsApi: {
    listTriggers: vi.fn(() =>
      Promise.resolve([
        {
          id: 'file-processor',
          event_type: 'file.created',
          condition: { Equals: { path: 'extension', value: '.pdf' } },
          action: { Goal: { goal: 'Inspect the new PDF and summarize it' } },
        },
      ]),
    ),
    createTrigger: createTriggerMock,
    deleteTrigger: vi.fn(),
    publishEvent: vi.fn(),
  },
}));

vi.mock('../api/executions', () => ({
  executionsApi: {
    list: vi.fn(() =>
      Promise.resolve([
        {
          id: 1,
          source_type: 'trigger',
          source_id: 'file-processor',
          action_type: 'create_trigger',
          status: 'completed',
          request_payload: { id: 'file-processor' },
          response_payload: { status: 'trigger_created' },
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

describe('Triggers Page', () => {
  it('renders registered triggers and diagnostics shortcuts', async () => {
    renderWithProviders(<Triggers />);

    expect(await screen.findByText('file-processor')).toBeInTheDocument();
    expect(screen.getByText('Recent Trigger Activity')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Execution History' })).toBeInTheDocument();
  });

  it('blocks submission when required guided fields are missing', async () => {
    renderWithProviders(<Triggers />);

    const triggerIdInput = await screen.findByDisplayValue('file-processor');
    fireEvent.change(triggerIdInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Trigger' }));

    expect((await screen.findAllByText('Trigger ID is required.')).length).toBeGreaterThan(0);
    expect(createTriggerMock).not.toHaveBeenCalled();
  });
});
