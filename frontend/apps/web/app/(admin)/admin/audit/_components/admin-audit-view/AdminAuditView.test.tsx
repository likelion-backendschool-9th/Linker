import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminAuditView } from './AdminAuditView';
import { actionLabel } from './hook';
import type { AuditLog } from './api';
vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});
const row = (id: number, createdAt: string): AuditLog => ({
  id,
  adminId: 1,
  admin: '운영자',
  actionType: 'VIEW_EMAIL',
  targetType: 'USER',
  targetId: id,
  target: `USER ${id}`,
  reason: '사유 확인',
  createdAt,
  sanctionStep: null,
});
it('includes KST boundaries and navigates the server cursor without inventing totals', async () => {
  vi.mocked(apiFetch).mockImplementation(async (url) =>
    url.endsWith('/filters')
      ? { admins: [{ id: 1, name: '운영자' }], actionTypes: ['VIEW_EMAIL'] }
      : url.includes('cursor=next')
        ? { items: [row(3, '2026-10-31T15:00:00Z')], nextCursor: null }
        : {
            items: [
              row(1, '2026-10-31T14:59:59Z'),
              row(2, '2026-11-01T14:59:59Z'),
              row(4, '2026-11-01T15:00:00Z'),
            ],
            nextCursor: 'next',
          },
  );
  renderWithProviders(<AdminAuditView />, {
    viewer: { role: 'operator' },
    searchParams: '?from=2026-11-01&to=2026-11-01',
  });
  const table = await screen.findByRole('table');
  expect(within(table).queryByText('사용자 #1')).not.toBeInTheDocument();
  expect(within(table).queryByText('사용자 #4')).not.toBeInTheDocument();
  expect(within(table).getByText('사용자 #2')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
  expect(await within(table).findByText('사용자 #3')).toBeVisible();
  expect(within(table).queryByText('사용자 #2')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '이전 페이지' }));
  expect(await within(table).findByText('사용자 #2')).toBeVisible();
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
it.each(['?from=2026-11-02&to=2026-11-01', '?from=2026-02-30'])(
  'rejects invalid initial dates without requesting audit rows (%s)',
  async (searchParams) => {
    vi.mocked(apiFetch).mockResolvedValue({ admins: [], actionTypes: [] });
    renderWithProviders(<AdminAuditView />, { viewer: { role: 'operator' }, searchParams });
    expect(screen.getByRole('alert')).toHaveTextContent('종료일은 시작일 이후로');
    expect(vi.mocked(apiFetch).mock.calls.every(([url]) => url.endsWith('/filters'))).toBe(true);
  },
);
it('uses the server sanction step for labels and searches only the current page without a new API parameter', async () => {
  const entry = {
    ...row(2, '2026-11-01T14:59:59Z'),
    actionType: 'SANCTION',
    sanctionStep: 'DAYS_7',
  };
  expect(actionLabel(entry)).toBe('7일 이용 제한');
  vi.mocked(apiFetch).mockImplementation(async (url) =>
    url.endsWith('/filters')
      ? { admins: [], actionTypes: [] }
      : { items: [entry], nextCursor: null },
  );
  renderWithProviders(<AdminAuditView />);
  await screen.findByRole('table');
  await userEvent.type(screen.getByRole('searchbox', { name: '대상 또는 사유 검색' }), '없음');
  expect(await screen.findByText('조건에 맞는 조치 기록이 없어요.')).toBeVisible();
  expect(vi.mocked(apiFetch).mock.calls.every(([url]) => !url.includes('q='))).toBe(true);
});
