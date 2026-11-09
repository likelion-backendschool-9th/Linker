import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { renderWithProviders } from '@/test/render-with-providers';
import type { AdminUserDetail } from '../../_lib/admin-user-queries';
import { AdminUserActionSheet } from './AdminUserActionSheet';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const user: AdminUserDetail = {
  id: 7,
  login: 'review-user',
  name: '검토 회원',
  avatarUrl: null,
  userType: 'DEVELOPER',
  emailMasked: 'rev***@example.com',
  status: 'SUSPENDED',
  joinedAt: '2026-10-01',
  allowedActions: { permanentSanction: false, liftSanction: false, refund: true },
  sanctions: [
    {
      id: 1,
      step: 'DAYS_7',
      reason: '반복 위반',
      reasonCode: 'OTHER',
      startsAt: '2026-11-01',
      endsAt: '2026-11-08',
      revokedAt: null,
      active: true,
    },
  ],
  reportHistory: [],
  subscriptions: [],
  payments: [{ id: 10, amount: 2900, status: 'DONE', paidAt: '2026-11-01', refundedAmount: 0 }],
  recruiter: null,
};
function renderAction(value: AdminUserDetail, action: string) {
  vi.mocked(apiFetch).mockResolvedValue(value);
  return renderWithProviders(<AdminUserActionSheet />, {
    viewer: { role: 'operator', login: 'operator' },
    searchParams: `?overlay=admin-user-action&oid=${action}`,
  });
}
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});
it.each([false, true])(
  'permanent suspension uses the server permission flag (%s)',
  async (allowed) => {
    renderAction(
      { ...user, allowedActions: { ...user.allowedActions, permanentSanction: allowed } },
      'sanction:7',
    );
    const option = await screen.findByRole('option', { name: '영구 정지 · 리드 운영자만 가능' });
    expect(option).toHaveProperty('disabled', !allowed);
  },
);
it('never reveals before recording a nonempty reason, and removes full email on unmount', async () => {
  const view = renderAction(user, 'email:7');
  await userEvent.click(await screen.findByRole('button', { name: '사유 기록 후 열람' }));
  expect(screen.getByLabelText('열람 사유 (필수)')).toHaveFocus();
  expect(vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    0,
  );
  vi.mocked(apiFetch).mockResolvedValue({ email: 'review-user@example.com' });
  await userEvent.type(screen.getByLabelText('열람 사유 (필수)'), '계정 복구 문의 확인');
  await userEvent.click(screen.getByRole('button', { name: '사유 기록 후 열람' }));
  expect(await screen.findByRole('status')).toHaveTextContent('review-user@example.com');
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/admin/users/7/email-reveal',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ reason: '계정 복구 문의 확인' }),
    }),
  );
  view.unmount();
  expect(screen.queryByText('review-user@example.com')).not.toBeInTheDocument();
});
it('a rejected email reveal preserves masking and the entered reason for retry', async () => {
  renderAction(user, 'email:7');
  await screen.findByLabelText('열람 사유 (필수)');
  vi.mocked(apiFetch).mockImplementation(async (_url, init) => {
    if (init?.method === 'POST')
      throw new ApiError(403, { code: 'FORBIDDEN', message: '운영자 인증이 필요해요' });
    return user;
  });
  await userEvent.type(screen.getByLabelText('열람 사유 (필수)'), '문의 확인');
  await userEvent.click(screen.getByRole('button', { name: '사유 기록 후 열람' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('운영자 인증이 필요해요');
  expect(screen.getByText('rev***@example.com')).toBeInTheDocument();
  expect(screen.getByLabelText('열람 사유 (필수)')).toHaveValue('문의 확인');
});
it('only a lead can submit a lift and the request addresses the selected active sanction', async () => {
  renderAction(
    { ...user, allowedActions: { ...user.allowedActions, liftSanction: true } },
    'lift:7',
  );
  await screen.findByRole('combobox', { name: '해제할 제재' });
  await userEvent.click(screen.getByRole('button', { name: '제재 해제' }));
  expect(screen.getByRole('checkbox')).toHaveFocus();
  vi.mocked(apiFetch).mockResolvedValue(undefined);
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: '제재 해제' }));
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/admin/users/7/sanctions/1', {
      method: 'DELETE',
    }),
  );
});
it('rejects lift for a non-lead without a request', async () => {
  renderAction(user, 'lift:7');
  expect(await screen.findByRole('button', { name: '제재 해제' })).toBeDisabled();
  expect(vi.mocked(apiFetch).mock.calls.every(([, init]) => !init?.method)).toBe(true);
});
it('keeps refunds disabled until the operator reason contract is available', async () => {
  renderAction(user, 'refund:7:10');
  expect(await screen.findByRole('status')).toHaveTextContent(
    '현재 환불을 처리할 수 없어요.',
  );
  expect(screen.getByRole('button', { name: '환불 실행' })).toBeDisabled();
  expect(vi.mocked(apiFetch).mock.calls.every(([, init]) => !init?.method)).toBe(true);
});
