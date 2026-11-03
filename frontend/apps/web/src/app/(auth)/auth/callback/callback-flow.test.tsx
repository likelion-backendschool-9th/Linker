import { waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { StrictMode } from 'react';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { CallbackFlow } from './callback-flow';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

it('exchanges once in the WebView and refreshes server session data after login', async () => {
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
  vi.mocked(apiFetch).mockResolvedValue({ isNew: false, restored: false, returnTo: '/workspace' });
  window.ReactNativeWebView = { postMessage: vi.fn() };
  try {
    renderWithProviders(
      <StrictMode>
        <CallbackFlow client="app" code="code" state="state" returnTo="/feed" errorCode="" />
      </StrictMode>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/workspace'));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledOnce();
  } finally {
    delete window.ReactNativeWebView;
  }
});
