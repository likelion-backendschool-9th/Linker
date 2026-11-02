import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import { apiFetch } from '@/lib/api/api-fetch';
import type { PaymentResult } from '@/features/subscription/subscription-api';
import { renderWithProviders } from '@/test/render-with-providers';

import { PaymentSuccess } from './payment-success';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const fetchMock = vi.mocked(apiFetch);
const payment = { orderId: 'order-1', amount: 2900, paymentKey: 'key' };
beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
});
it('does not show benefits until server approval resolves', async () => {
  let approve!: (result: PaymentResult) => void;
  fetchMock.mockReturnValue(
    new Promise<PaymentResult>((resolve) => {
      approve = resolve;
    }),
  );
  renderWithProviders(<PaymentSuccess payment={payment} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(screen.queryByText('결제를 완료했어요')).not.toBeInTheDocument();
  approve({
    status: 'ACTIVE',
    planKey: 'PRO',
    amount: 2900,
    expiresOn: '2026-12-01',
    benefits: ['사진 10장'],
  });
  expect(await screen.findByText('결제를 완료했어요')).toBeVisible();
});
it('does not call approval for an invalid callback URL', () => {
  renderWithProviders(<PaymentSuccess payment={null} />);
  expect(screen.getByText('결제 정보를 확인할 수 없어요')).toBeVisible();
  expect(fetchMock).not.toHaveBeenCalled();
});
it('keeps benefits locked when the approval API fails', async () => {
  fetchMock.mockImplementation(async () => {
    throw new Error('offline');
  });
  renderWithProviders(<PaymentSuccess payment={payment} />);
  expect(await screen.findByText('결제 승인을 확인하지 못했어요')).toBeVisible();
  expect(screen.queryByText('결제를 완료했어요')).not.toBeInTheDocument();
});

it('returns to plans when callback information is invalid', async () => {
  renderWithProviders(<PaymentSuccess payment={null} />);
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(replace).toHaveBeenCalledWith('/subscribe');
});
