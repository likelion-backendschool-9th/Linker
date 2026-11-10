import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { NativeToWeb } from '@linker/bridge';
import { isInApp, requestNative } from '@/lib/bridge/native';
import { InviteLinkActions } from './InviteLinkActions';

vi.mock('@/lib/bridge/native', () => ({ isInApp: vi.fn(), requestNative: vi.fn() }));
const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');
afterEach(() => {
  if (shareDescriptor) Object.defineProperty(navigator, 'share', shareDescriptor);
  else Reflect.deleteProperty(navigator, 'share');
  vi.resetAllMocks();
});
it('keeps clipboard permission across a deferred invite URL', async () => {
  const write = vi.fn().mockResolvedValue(undefined);
  const ClipboardItemMock = vi.fn(function ClipboardItem(this: unknown, items: unknown) {
    return items;
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { write, writeText: vi.fn() },
  });
  Object.defineProperty(window, 'ClipboardItem', {
    configurable: true,
    value: ClipboardItemMock,
  });

  const { useInviteLinkActions } = await import('./hook');
  let api!: ReturnType<typeof useInviteLinkActions>;
  function Probe() {
    api = useInviteLinkActions('unused');
    return null;
  }
  render(<Probe />);

  let release!: (href: string) => void;
  const href = new Promise<string>((resolve) => {
    release = resolve;
  });
  const pending = api.copyDeferred(href);
  expect(write).toHaveBeenCalledOnce();
  const firstCall = write.mock.calls[0];
  const items = firstCall?.[0] as [{ 'text/plain': Promise<Blob> }] | undefined;
  expect(items?.[0]).toBeDefined();
  release('http://localhost:3000/invite/live-code');
  await expect(items![0]!['text/plain'].then((blob) => blob.text())).resolves.toBe(
    'http://localhost:3000/invite/live-code',
  );
  await expect(pending).resolves.toBe(true);
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
    expect(requestNative).toHaveBeenCalledWith(
      {
        type: 'SHARE',
        title: 'Linker 팀 초대',
        url: expect.stringMatching(/\/invite\/sample$/),
      },
      { timeoutMs: 0 },
    ),
  );
});

it('keeps sharing pending and prevents duplicate native dialogs until the user closes it', async () => {
  vi.mocked(isInApp).mockReturnValue(true);
  let finish!: (reply: Extract<NativeToWeb, { type: 'RESULT' }>) => void;
  vi.mocked(requestNative).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<InviteLinkActions code="sample" />);
  const button = screen.getByRole('button', { name: '공유' });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(requestNative).toHaveBeenCalledOnce();
  await act(async () =>
    finish({ type: 'RESULT', id: 'reply', ok: true, payload: { action: 'dismissedAction' } }),
  );
  expect(button).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
