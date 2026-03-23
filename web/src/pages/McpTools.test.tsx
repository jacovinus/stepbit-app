import { render, screen } from '@testing-library/react';
import McpTools from './McpTools';
import { describe, it, expect, vi } from 'vitest';

// Mocking the API client
vi.mock('../api/llm', () => ({
  getMcpTools: vi.fn(() => Promise.resolve([{ name: 'test-tool', description: 'desc', input_schema: {} }]))
}));

describe('McpTools Page', () => {
  it('should show the list of tools', async () => {
    render(<McpTools />);
    expect((await screen.findAllByText('test-tool')).length).toBeGreaterThan(0);
    expect(screen.getByText('desc')).toBeInTheDocument();
  });
});
