import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { TurnCapabilityContextCard } from './TurnCapabilityContextCard';
import { renderWithProviders } from '../../test/renderWithProviders';

describe('TurnCapabilityContextCard', () => {
  it('renders turn capability metadata', () => {
    renderWithProviders(
      <TurnCapabilityContextCard
        context={{
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
        }}
      />,
    );

    expect(screen.getByText('search on')).toBeInTheDocument();
    expect(screen.getByText('1 providers')).toBeInTheDocument();
    expect(screen.getAllByText('internet_search').length).toBeGreaterThan(0);
  });
});
