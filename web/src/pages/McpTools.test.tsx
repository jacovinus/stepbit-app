import { screen } from '@testing-library/react';
import McpTools from './McpTools';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';

// Mocking the API client
vi.mock('../api/llm', () => ({
  getMcpTools: vi.fn(() =>
    Promise.resolve([
      {
        name: 'test-tool',
        description: 'desc',
        input_schema: {},
        provider_id: 'quantlab',
        read_only: true,
        open_world: false,
        destructive: false,
        tags: ['data'],
      },
    ]),
  ),
  getMcpProviders: vi.fn(() =>
    Promise.resolve([
      {
        id: 'quantlab',
        name: 'quantlab',
        provider_type: 'external',
        scope: 'project',
        enabled: true,
        status: 'installed',
        reason: null,
        capabilities: ['quant-research', 'command:run', 'command:sweep'],
        tool_count: 4,
        installed_tools: ['quantlab_run', 'quantlab_sweep', 'quantlab_forward', 'quantlab_portfolio'],
        planned_tools: [],
      },
    ]),
  ),
  fetchMcpProviderDoc: vi.fn(() => Promise.resolve('# quantlab\n\nPlanned provider docs.')),
}));

describe('McpTools Page', () => {
  it('should show the list of tools', async () => {
    renderWithProviders(<McpTools />);
    expect((await screen.findAllByText('test-tool')).length).toBeGreaterThan(0);
    expect(screen.getByText('desc')).toBeInTheDocument();
    expect(screen.getByText('Installed Capability Providers')).toBeInTheDocument();
    expect(screen.getAllByText('Read only').length).toBeGreaterThan(0);
    expect(screen.getAllByText('project').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Open System View' })).toBeInTheDocument();
    expect(screen.getByText('MCP Tool Playground')).toBeInTheDocument();
  });
});
