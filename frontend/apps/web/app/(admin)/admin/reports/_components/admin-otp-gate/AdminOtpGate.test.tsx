import { fireEvent, screen, waitFor } from '@testing-library/react';

import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { renderWithProviders } from '@/test/render-with-providers';

import { AdminOtpGate } from './AdminOtpGate';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

describe('AdminOtpGate', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('does not render reports until the OTP code is accepted', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ verified: true });
    renderWithProviders(
      <AdminOtpGate>
        <p>신고 목록</p>
      </AdminOtpGate>,
    );

    expect(screen.queryByText('신고 목록')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('인증 코드'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '인증하고 신고 보기' }));

    await waitFor(() => expect(screen.getByText('신고 목록')).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/admin/otp/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: '123456' }),
      }),
    );
  });

  it('keeps reports hidden and shows the server message when verification fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(400, {
        code: 'OTP_INVALID',
        message: '인증 코드가 맞지 않아요',
      }),
    );
    renderWithProviders(
      <AdminOtpGate>
        <p>신고 목록</p>
      </AdminOtpGate>,
    );

    fireEvent.change(screen.getByLabelText('인증 코드'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: '인증하고 신고 보기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('인증 코드가 맞지 않아요');
    expect(screen.queryByText('신고 목록')).not.toBeInTheDocument();
  });
});
