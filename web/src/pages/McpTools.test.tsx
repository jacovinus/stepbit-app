import { screen } from '@testing-library/react';
import McpTools from './McpTools';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';

// Mocking the API client
vi.mock('../api/llm', () => ({
  getMcpTools: vi.fn(() => Promise.resolve([{ name: 'test-tool', description: 'desc', input_schema: {} }])),
  getMcpProviders: vi.fn(() =>
    Promise.resolve([
      {
        name: 'quantlab',
        enabled: true,
        status: 'installed',
        reason: null,
        capabilities: ['quant-research'],
        installed_tools: ['quantlab_run'],
        planned_tools: ['quantlab_sweep'],
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
    expect(screen.getByRole('link', { name: 'Open System View' })).toBeInTheDocument();
    expect(screen.getByText('MCP Tool Playground')).toBeInTheDocument();
    expect(screen.getByText('Planned Tool Surface')).toBeInTheDocument();
    expect(screen.getByText('quantlab • quantlab_sweep')).toBeInTheDocument();
    expect(screen.getByText('Planned Tool Details')).toBeInTheDocument();
    expect(await screen.findAllByText('Provider Guide')).not.toHaveLength(0);
    expect(await screen.findByText('Planned provider docs.')).toBeInTheDocument();
  });
});
