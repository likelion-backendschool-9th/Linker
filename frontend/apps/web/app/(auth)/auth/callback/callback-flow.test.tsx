import { waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { StrictMode } from 'react';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { CallbackFlow } from './callback-flow';
import styles from './callback-flow.module.css';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

it('keeps the login callback pending screen free of the three-dot loading mark', () => {
  vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {}));
  const { container } = renderWithProviders(
    <CallbackFlow code="code" state="state" returnTo="/feed" errorCode="" />,
  );

  expect(container.querySelector(`.${styles.dots}`)).toBeNull();
});

it('exchanges once in the WebView and refreshes server session data after login', async () => {
  vi.mocked(apiFetch).mockClear();
  const router = {
    bfcacheId: 'test',
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  vi.mocked(useRouter).mockReturnValue(router);
  vi.mocked(apiFetch).mockImplementation(async (url) =>
    url === '/api/v1/user/me'
      ? { userId: 1, userType: 'DEVELOPER' }
      : { isNew: false, restored: false, returnTo: '/workspace' },
  );
  window.ReactNativeWebView = { postMessage: vi.fn() };
  try {
    renderWithProviders(
      <StrictMode>
        <CallbackFlow client="app" code="code" state="state" returnTo="/feed" errorCode="" />
      </StrictMode>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/workspace'));
    expect(
      vi.mocked(apiFetch).mock.calls.filter(([url]) => url.endsWith('/auth/github/callback')),
    ).toHaveLength(1);
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/user/me');
    expect(router.refresh).toHaveBeenCalledOnce();
  } finally {
    delete window.ReactNativeWebView;
  }
});
