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

vi.mock('../api/llm', () => ({
  getCoreRecentEvents: vi.fn(() =>
    Promise.resolve([
      {
        id: 'evt-1',
        event_type: 'file.created',
        payload: { extension: '.pdf', path: '/tmp/report.pdf' },
        timestamp: '2026-03-23T10:00:00.000Z',
        source_node: 'watcher',
      },
    ]),
  ),
  getCoreSystemRuntime: vi.fn(() =>
    Promise.resolve({
      state_dir: '/tmp/stepbit-core',
      cron_db_path: '/tmp/stepbit-core/cron.db',
      events_db_path: '/tmp/stepbit-core/events.db',
      models_on_disk: 1,
      loaded_models: 1,
      mcp_providers: 2,
      installed_mcp_providers: 2,
      trigger_count: 3,
      scheduler_active: true,
      temp: {
        registered_resources: 0,
        total_size_bytes: 0,
        pressure_level: 'normal',
        global_usage_bytes: 0,
        global_usage_files: 0,
        global_max_bytes: 0,
        global_max_files: 0,
        per_owner_max_bytes: 0,
        per_owner_max_files: 0,
      },
    }),
  ),
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
    expect(screen.getByText('Core Event Bus')).toBeInTheDocument();
    expect(screen.getByText('Latest Persisted Events')).toBeInTheDocument();
    expect(screen.getByText('watcher')).toBeInTheDocument();
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
