import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { BlockConfirmDialog } from './BlockConfirmDialog';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  resetOverlayHistory();
  vi.mocked(apiFetch).mockReset().mockResolvedValue(undefined);
});

it('blocks the user through ModerationController and closes', async () => {
  const onBlocked = vi.fn();
  renderWithProviders(<BlockConfirmDialog userId={7} name="민수" onBlocked={onBlocked} />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?overlay=block&oid=7',
  });

  expect(await screen.findByRole('heading', { name: '민수님을 차단할까요?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '차단' }));

  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/user/blocks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 7 }),
      }),
    ),
  );
  expect(onBlocked).toHaveBeenCalled();
});
