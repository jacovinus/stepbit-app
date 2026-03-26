import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StructuredArtifactsCard } from './StructuredArtifactsCard';
import type { Message } from '../../types';

const assistantMessage: Message = {
  id: 1,
  session_id: 'session-1',
  role: 'assistant',
  content: 'Here is the summary.',
  model: null,
  token_count: null,
  created_at: new Date().toISOString(),
  metadata: {
    turn_context: {
      search_enabled: true,
      reason_enabled: false,
      requested_tools: ['internet_search'],
      available_tools: [
        {
          name: 'internet_search',
          provider_id: 'web',
          enabled: true,
          read_only: true,
          open_world: true,
          tags: ['web'],
        },
      ],
      used_tools: ['internet_search'],
    },
    output_items: [
      {
        id: 'tool-0-citation-0',
        item_type: 'citation',
        role: 'assistant',
        status: 'completed',
        content: [
          {
            content_type: 'citation',
            text: 'Example Source',
            citation: {
              source_id: 'src_1',
              title: 'Example Source',
              url: 'https://example.com/story',
              snippet: 'Example snippet',
            },
          },
        ],
      },
      {
        id: 'tool-0-artifact-0',
        item_type: 'artifact',
        role: 'assistant',
        status: 'completed',
        content: [
          {
            content_type: 'artifact',
            text: 'Equity Curve',
            artifact: {
              family: 'chart',
              title: 'Equity Curve',
              source_tool: 'internet_search',
              data: {
                role: 'chart',
                type: 'line',
                data: [{ name: 't1', value: 10 }],
              },
            },
          },
        ],
      },
    ],
  },
};

describe('StructuredArtifactsCard', () => {
  it('renders citations and artifacts from assistant metadata', () => {
    render(<StructuredArtifactsCard message={assistantMessage} />);

    expect(screen.getByText('1 citations')).toBeInTheDocument();
    expect(screen.getByText('Example Source')).toBeInTheDocument();
    expect(screen.getByText('1 artifacts')).toBeInTheDocument();
    expect(screen.getByText('Equity Curve')).toBeInTheDocument();
  });
});
