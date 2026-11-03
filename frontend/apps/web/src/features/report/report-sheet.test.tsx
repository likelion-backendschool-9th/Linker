import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { ReportSheet } from './report-sheet';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  resetOverlayHistory();
  vi.mocked(apiFetch).mockReset().mockResolvedValue(undefined);
});

it('submits a report for the overlay target and closes', async () => {
  renderWithProviders(<ReportSheet />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?overlay=report&oid=POST:12',
  });

  expect(await screen.findByRole('heading', { name: '신고하기' })).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('스팸·홍보'));
  await userEvent.click(screen.getByRole('button', { name: '신고하기' }));

  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/user/reports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          targetType: 'POST',
          targetId: '12',
          reason: 'SPAM',
          detail: '',
        }),
      }),
    ),
  );
});

it('requires detail text when the reason is OTHER', async () => {
  renderWithProviders(<ReportSheet />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?overlay=report&oid=USER:3',
  });

  await screen.findByRole('heading', { name: '신고하기' });
  await userEvent.click(screen.getByLabelText('기타'));
  await userEvent.click(screen.getByRole('button', { name: '신고하기' }));

  expect(await screen.findByText('기타 사유를 적어 주세요.')).toBeInTheDocument();
  expect(apiFetch).not.toHaveBeenCalled();
});
