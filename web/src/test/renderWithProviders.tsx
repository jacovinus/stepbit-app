import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { render } from '@testing-library/react';
import { AppDialogProvider } from '../components/ui/AppDialogProvider';

type RenderOptions = {
  route?: string;
};

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const { route = '/' } = options;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppDialogProvider>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </AppDialogProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
