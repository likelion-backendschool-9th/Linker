import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminAuditView } from './admin-audit-view';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});
const row = (id: number, createdAt: string) => ({
  id,
  admin: '운영자',
  actionType: 'EMAIL_REVEAL',
  target: `USER ${id}`,
  reason: '사유 확인',
  createdAt,
});
it('includes both KST day boundaries and appends the cursor page in latest-first order', async () => {
  vi.mocked(apiFetch).mockImplementation(async (url) => {
    if (url.endsWith('/filters')) return { admins: [], actionTypes: [] };
    if (url.includes('cursor=next'))
      return { items: [row(3, '2026-10-31T15:00:00Z')], nextCursor: null };
    return {
      items: [
        row(1, '2026-10-31T14:59:59Z'),
        row(2, '2026-11-01T14:59:59Z'),
        row(4, '2026-11-01T15:00:00Z'),
      ],
      nextCursor: 'next',
    };
  });
  renderWithProviders(<AdminAuditView />, {
    viewer: { role: 'operator' },
    searchParams: '?from=2026-11-01&to=2026-11-01',
  });
  const table = await screen.findByRole('table');
  expect(within(table).queryByText('USER 1')).not.toBeInTheDocument();
  expect(within(table).queryByText('USER 4')).not.toBeInTheDocument();
  expect(within(table).getByText('USER 2')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: '더 보기' }));
  expect(await within(table).findByText('USER 3')).toBeVisible();
  expect(
    within(table)
      .getAllByRole('row')
      .slice(1)
      .map((item) => item.textContent),
  ).toEqual([expect.stringContaining('USER 2'), expect.stringContaining('USER 3')]);
  expect(
    vi
      .mocked(apiFetch)
      .mock.calls.some(
        ([url]) =>
          url.includes('from=2026-11-01') &&
          url.includes('to=2026-11-01') &&
          url.includes('cursor=next'),
      ),
  ).toBe(true);
});
it('an invalid initial range is explained without requesting audit data', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ admins: [], actionTypes: [] });
  renderWithProviders(<AdminAuditView />, {
    viewer: { role: 'operator' },
    searchParams: '?from=2026-11-02&to=2026-11-01',
  });
  expect(screen.getByRole('alert')).toHaveTextContent('종료일은 시작일 이후로');
  expect(vi.mocked(apiFetch).mock.calls.every(([url]) => url.endsWith('/filters'))).toBe(true);
});
