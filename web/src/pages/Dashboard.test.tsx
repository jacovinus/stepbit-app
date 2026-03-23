import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/sessions', () => ({
  sessionsApi: {
    getStats: vi.fn(() =>
      Promise.resolve({
        total_sessions: 4,
        total_messages: 42,
        total_tokens: 4200,
        db_size_bytes: 2048,
        memory_usage: [{ tag: 'chat_sessions', usage_bytes: 1024 }],
      }),
    ),
    list: vi.fn(() =>
      Promise.resolve([
        {
          id: 'session-1',
          title: 'Ops Session',
          created_at: '2026-03-23T10:00:00.000Z',
          metadata: { message_count: 3 },
        },
      ]),
    ),
  },
}));

vi.mock('../api/executions', () => ({
  executionsApi: {
    list: vi.fn(() =>
      Promise.resolve([
        {
          id: 1,
          source_type: 'pipeline',
          source_id: 'nightly_analysis',
          action_type: 'execute_pipeline',
          status: 'failed',
          request_payload: {},
          response_payload: {},
          error: 'planner timeout',
          created_at: '2026-03-23T10:00:00.000Z',
          completed_at: '2026-03-23T10:00:01.000Z',
        },
      ]),
    ),
  },
}));

vi.mock('../api/llm', () => ({
  getCoreHealthReport: vi.fn(() =>
    Promise.resolve({
      status: 'healthy',
      ok: true,
      checks: [
        { name: 'state_dir', ok: true, detail: '/Users/test/.stepbit-core' },
        { name: 'models_dir', ok: true, detail: '1 model(s) available' },
      ],
    }),
  ),
  getCoreReadinessReport: vi.fn(() =>
    Promise.resolve({
      status: 'ready',
      ready: true,
      reasons: [],
      checks: [
        { name: 'models_available', ok: true, detail: '1 model(s) detected on disk' },
        { name: 'mcp_providers_ready', ok: true, detail: '2 enabled provider(s) installed' },
      ],
      context: {
        state_dir: '/Users/test/.stepbit-core',
        cron_db_path: '/Users/test/.stepbit-core/cron_jobs.db',
        events_db_path: '/Users/test/.stepbit-core/events.db',
        models_on_disk: 1,
        loaded_models: 1,
        mcp_enabled: 2,
        mcp_installed: 2,
        cron_scheduler_running: true,
      },
    }),
  ),
  getMcpProviders: vi.fn(() =>
    Promise.resolve([
      {
        name: 'duckdb',
        enabled: true,
        status: 'installed',
        reason: null,
        capabilities: ['sql-query', 'local-data'],
        installed_tools: ['duckdb_query'],
      },
      {
        name: 'quantlab',
        enabled: true,
        status: 'installed',
        reason: null,
        capabilities: ['quant-research', 'artifact-generation'],
        installed_tools: ['quantlab_run'],
      },
    ]),
  ),
}));

vi.mock('../hooks/useHealthCheck', () => ({
  useHealthCheck: () => ({
    apiConnected: true,
    dbConnected: true,
    llmosConnected: true,
    llmosReady: true,
  }),
}));

vi.mock('../hooks/useStepbitCore', () => ({
  useStepbitCore: () => ({
    online: true,
    ready: true,
    message: 'stepbit-core ready',
    active_model: 'gpt-5.4',
    supported_models: ['gpt-5.4'],
    metrics: {
      requests_total: 99,
      tokens_generated_total: 1000,
      active_sessions: 2,
      token_latency_avg_ms: 120,
    },
    warnings: ['High memory watermark'],
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

describe('Dashboard Page', () => {
  it('shows runtime diagnostics and navigation to execution history', async () => {
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText('System Overview')).toBeInTheDocument();
    expect(await screen.findByText('planner timeout')).toBeInTheDocument();
    expect(await screen.findByText('MCP Peripherals')).toBeInTheDocument();
    expect(await screen.findByText('Control Plane')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open System View' })).toBeInTheDocument();
    expect(await screen.findByText('quantlab')).toBeInTheDocument();
    expect(screen.getByText('Latest Failure')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Execution History' })).toBeInTheDocument();
  });
});
