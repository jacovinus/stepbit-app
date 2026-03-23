import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { System } from './System';

vi.mock('../api/pipelines', () => ({
  pipelinesApi: {
    getStepbitCoreStatus: vi.fn(() =>
      Promise.resolve({
        online: true,
        ready: true,
        message: 'stepbit-core is ready',
        active_model: 'gpt-5.4',
        supported_models: ['gpt-5.4'],
        metrics: {
          requests_total: 32,
          tokens_generated_total: 1200,
          active_sessions: 1,
          token_latency_avg_ms: 90,
        },
        warnings: [],
        capabilities: {
          planner_http: false,
          replan_http: false,
          distributed_http: false,
          metrics_http: true,
          mcp_registry_http: true,
        },
      }),
    ),
  },
}));

vi.mock('../api/llm', () => ({
  getCoreHealthReport: vi.fn(() =>
    Promise.resolve({
      status: 'healthy',
      ok: true,
      checks: [{ name: 'state_dir', ok: true, detail: '/Users/test/.stepbit-core' }],
    }),
  ),
  getCoreReadinessReport: vi.fn(() =>
    Promise.resolve({
      status: 'ready',
      ready: true,
      reasons: [],
      checks: [{ name: 'models_available', ok: true, detail: '1 model(s) detected on disk' }],
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
  getCoreSystemRuntime: vi.fn(() =>
    Promise.resolve({
      state_dir: '/Users/test/.stepbit-core',
      cron_db_path: '/Users/test/.stepbit-core/cron_jobs.db',
      events_db_path: '/Users/test/.stepbit-core/events.db',
      models_on_disk: 1,
      loaded_models: 1,
      mcp_providers: 2,
      installed_mcp_providers: 2,
      trigger_count: 3,
      scheduler_active: true,
      temp: {
        registered_resources: 4,
        total_size_bytes: 4096,
        pressure_level: 'Normal',
        global_usage_bytes: 4096,
        global_usage_files: 4,
        global_max_bytes: 102400,
        global_max_files: 100,
        per_owner_max_bytes: 51200,
        per_owner_max_files: 50,
      },
    }),
  ),
  getCoreCronStatus: vi.fn(() =>
    Promise.resolve({
      scheduler_running: true,
      total_jobs: 2,
      failing_jobs: 0,
      retrying_jobs: 1,
    }),
  ),
  getCoreRecentEvents: vi.fn(() =>
    Promise.resolve([
      {
        id: 'evt-1',
        event_type: 'file.created',
        payload: { path: '/tmp/report.pdf' },
        timestamp: '2026-03-23T10:00:00.000Z',
        source_node: 'watcher',
      },
    ]),
  ),
  getMcpProviders: vi.fn(() =>
    Promise.resolve([
      {
        name: 'duckdb',
        enabled: true,
        status: 'installed',
        reason: null,
        capabilities: ['sql-query'],
        installed_tools: ['duckdb_query'],
        planned_tools: [],
      },
      {
        name: 'quantlab',
        enabled: true,
        status: 'installed',
        reason: null,
        capabilities: ['quant-research', 'multi-tool-surface'],
        installed_tools: ['quantlab_run'],
        planned_tools: ['quantlab_sweep', 'quantlab_forward', 'quantlab_portfolio'],
      },
    ]),
  ),
}));

describe('System Page', () => {
  it('shows runtime, cron, and recent events diagnostics', async () => {
    renderWithProviders(<System />);

    expect(await screen.findByText('System Control Plane')).toBeInTheDocument();
    expect(await screen.findByText('Cron Runtime')).toBeInTheDocument();
    expect(await screen.findByText('Recent Events')).toBeInTheDocument();
    expect(await screen.findByText('file.created')).toBeInTheDocument();
    expect(await screen.findByText('watcher')).toBeInTheDocument();
    expect(await screen.findByText('Planned Tools')).toBeInTheDocument();
    expect(await screen.findByText('quantlab_sweep')).toBeInTheDocument();
  });
});
