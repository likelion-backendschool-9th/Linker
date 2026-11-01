import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { isInApp, requestNative } from '@/lib/bridge/native';
import { InviteLinkActions } from './invite-link-actions';

vi.mock('@/lib/bridge/native', () => ({ isInApp: vi.fn(), requestNative: vi.fn() }));
const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');
afterEach(() => {
  if (shareDescriptor) Object.defineProperty(navigator, 'share', shareDescriptor);
  else Reflect.deleteProperty(navigator, 'share');
  vi.resetAllMocks();
});
it('cancelling browser sharing is not reported as an error', async () => {
  vi.mocked(isInApp).mockReturnValue(false);
  const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  render(<InviteLinkActions code="sample" />);
  fireEvent.click(screen.getByRole('button', { name: '공유' }));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(requestNative).not.toHaveBeenCalled();
});
it('in-app sharing uses the existing SHARE bridge and only the invitation URL', async () => {
  vi.mocked(isInApp).mockReturnValue(true);
  vi.mocked(requestNative).mockResolvedValue({ type: 'RESULT', id: 'reply', ok: true });
  render(<InviteLinkActions code="sample" />);
  fireEvent.click(screen.getByRole('button', { name: '공유' }));
  await waitFor(() =>
    expect(requestNative).toHaveBeenCalledWith({
      type: 'SHARE',
      title: 'Linker 팀 초대',
      url: expect.stringMatching(/\/invite\/sample$/),
    }),
  );
});
