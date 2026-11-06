import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { safeStorage } from '@/lib/browser/safe-storage';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { ExternalLinkSheet } from './ExternalLinkSheet';
import * as openExternal from '../open-external';

beforeEach(() => {
  resetOverlayHistory();
  safeStorage.remove('linker:external-domains');
  vi.spyOn(openExternal, 'openExternalNow').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('confirms the domain once then opens the external URL', async () => {
  const href = 'https://github.com/org/repo';
  renderWithProviders(<ExternalLinkSheet />, {
    searchParams: `?overlay=external-link&oid=${encodeURIComponent(href)}`,
  });

  expect(await screen.findByRole('heading', { name: '외부 사이트로 이동합니다' })).toBeInTheDocument();
  expect(screen.getByText(/github\.com/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '이동' }));
  expect(openExternal.isDomainConfirmed('github.com')).toBe(true);
  expect(openExternal.openExternalNow).toHaveBeenCalledWith(href);
});
