import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';
import type { AdminUserDetail } from '../_lib/admin-user-queries';
import { AdminUserActionSheet } from './admin-user-action-sheet';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const user: AdminUserDetail = {
  id: 7,
  login: 'review-user',
  name: '검토 회원',
  avatarUrl: '',
  userType: 'DEVELOPER',
  emailMasked: 'rev***@example.com',
  status: 'SUSPENDED',
  needsReview: true,
  joinedAt: '2026-10-01',
  allowedActions: { permanentSanction: false, liftSanction: false, refund: true },
  sanctions: [
    { id: 1, step: 'DAYS_7', reason: '반복 위반', startsAt: '2026-11-01', endsAt: '2026-11-08' },
  ],
  reportHistory: [],
  subscription: null,
  payments: [{ id: 10, amount: 2900, status: 'PAID', paidAt: '2026-11-01' }],
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
    expect(screen.getByRole('button', { name: '제재 적용' })).toBeDisabled();
  },
);
it('a lead can preview lifting a specific sanction while the final action stays disabled', async () => {
  renderAction(
    { ...user, allowedActions: { ...user.allowedActions, liftSanction: true } },
    'lift:7',
  );
  expect(await screen.findByRole('combobox', { name: '해제할 제재' })).toHaveValue('1');
  await userEvent.click(screen.getByRole('button', { name: '입력 내용 확인' }));
  expect(screen.getByLabelText('해제 사유 (필수)')).toHaveFocus();
  await userEvent.type(screen.getByLabelText('해제 사유 (필수)'), '이의 제기 검토');
  await userEvent.click(screen.getByRole('button', { name: '입력 내용 확인' }));
  expect(screen.getByRole('status')).toHaveTextContent('조치는 실행되지 않았어요');
  expect(screen.getByRole('button', { name: '제재 해제' })).toBeDisabled();
  expect(
    vi.mocked(apiFetch).mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
  ).toBe(true);
});
it('a refund requires consent as well as a reason and exposes only the selected payment', async () => {
  renderAction(user, 'refund:7:10');
  await userEvent.type(await screen.findByLabelText('환불 사유 (필수)'), '미사용 결제 확인');
  await userEvent.click(screen.getByRole('button', { name: '입력 내용 확인' }));
  expect(screen.getByRole('checkbox')).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('대상 결제와 환불 금액을 확인해 주세요.');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: '입력 내용 확인' }));
  expect(screen.getByRole('status')).toHaveTextContent('조치는 실행되지 않았어요');
  expect(screen.getByRole('button', { name: '환불 실행' })).toBeDisabled();
});
