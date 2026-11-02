import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';

import { ViewerProvider, type ClientViewer } from '@/lib/auth/viewer-context';

type Options = {
  viewer?: Partial<ClientViewer>;
  searchParams?: string;
  onUrlUpdate?: OnUrlUpdateFunction;
};

/** Renders a client component with the providers it expects (query client, nuqs, viewer). */
export function renderWithProviders(
  ui: ReactElement,
  { viewer, searchParams = '', onUrlUpdate }: Options = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fullViewer: ClientViewer = {
    role: 'guest',
    login: null,
    status: null,
    suspendedUntil: null,
    ...viewer,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
        <ViewerProvider viewer={fullViewer}>{ui}</ViewerProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}
