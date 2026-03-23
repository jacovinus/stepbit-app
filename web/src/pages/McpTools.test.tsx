import { screen } from '@testing-library/react';
import McpTools from './McpTools';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';

// Mocking the API client
vi.mock('../api/llm', () => ({
  getMcpTools: vi.fn(() => Promise.resolve([{ name: 'test-tool', description: 'desc', input_schema: {} }]))
}));

describe('McpTools Page', () => {
  it('should show the list of tools', async () => {
    renderWithProviders(<McpTools />);
    expect((await screen.findAllByText('test-tool')).length).toBeGreaterThan(0);
    expect(screen.getByText('desc')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open System View' })).toBeInTheDocument();
    expect(screen.getByText('MCP Tool Playground')).toBeInTheDocument();
  });
});
