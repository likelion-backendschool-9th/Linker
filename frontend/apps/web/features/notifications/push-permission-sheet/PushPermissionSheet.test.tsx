import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';

import { isInApp, requestNative } from '@/lib/bridge/native';
import { safeStorage } from '@/lib/browser/safe-storage';
import { resetOverlayHistory, useActiveOverlay, useOverlay } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { PushPermissionSheet } from './PushPermissionSheet';
import { PUSH_PERMISSION_SEEN_KEY } from './hook';

vi.mock('@/lib/bridge/native', () => ({ isInApp: vi.fn(), requestNative: vi.fn() }));

beforeEach(() => {
  vi.mocked(isInApp).mockReturnValue(true);
  vi.mocked(requestNative).mockReset();
  vi.mocked(usePathname).mockReturnValue('/feed');
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 15)');
  safeStorage.remove(PUSH_PERMISSION_SEEN_KEY);
  resetOverlayHistory();
});
afterEach(() => {
  vi.restoreAllMocks();
  safeStorage.remove(PUSH_PERMISSION_SEEN_KEY);
});

function OtherOverlayControls() {
  const active = useActiveOverlay();
  const report = useOverlay('report');
  return (
    <>
      <button onClick={active.close}>다른 시트 닫기</button>
      <button onClick={() => report.open()}>다른 시트 열기</button>
      <output data-testid="overlay">{active.overlay ?? 'closed'}</output>
    </>
  );
}

it('explains Android push on first launch without asking for OS permission automatically', async () => {
  const first = renderWithProviders(<PushPermissionSheet />);
  expect(await screen.findByRole('dialog', { name: '푸시 알림' })).toBeVisible();
  expect(requestNative).not.toHaveBeenCalled();
  expect(safeStorage.get(PUSH_PERMISSION_SEEN_KEY)).toBe(true);
  first.unmount();
  renderWithProviders(<PushPermissionSheet />);
  await act(async () => {});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each(['browser', 'ios', 'callback'])(
  'does not interrupt %s with an Android prompt',
  async (mode) => {
    if (mode === 'browser') vi.mocked(isInApp).mockReturnValue(false);
    if (mode === 'ios') vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone');
    if (mode === 'callback') vi.mocked(usePathname).mockReturnValue('/auth/callback');
    renderWithProviders(<PushPermissionSheet />);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(requestNative).not.toHaveBeenCalled();
    expect(safeStorage.get(PUSH_PERMISSION_SEEN_KEY)).toBeNull();
  },
);

it('waits for another owner’s overlay instead of replacing it', async () => {
  renderWithProviders(
    <>
      <PushPermissionSheet />
      <OtherOverlayControls />
    </>,
    {
      searchParams: '?overlay=report',
    },
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('overlay')).toHaveTextContent('report');
  await userEvent.click(screen.getByRole('button', { name: '다른 시트 닫기' }));
  expect(await screen.findByRole('dialog', { name: '푸시 알림' })).toBeVisible();
});

it('requests permission only on consent and closes on grant', async () => {
  vi.mocked(requestNative).mockResolvedValue({
    type: 'RESULT',
    id: 'permission',
    ok: true,
    payload: { status: 'granted' },
  });
  renderWithProviders(<PushPermissionSheet />, { searchParams: '?overlay=push-permission' });
  await userEvent.click(await screen.findByRole('button', { name: '알림 허용하기' }));
  expect(requestNative).toHaveBeenCalledExactlyOnceWith(
    { type: 'PUSH_PERMISSION_REQUEST' },
    { timeoutMs: 0 },
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it.each(['denied', 'unconfigured', 'transport'])(
  'keeps a useful error when permission is %s',
  async (status) => {
    if (status === 'transport') vi.mocked(requestNative).mockRejectedValue(new Error('transport'));
    else
      vi.mocked(requestNative).mockResolvedValue(
        status === 'denied'
          ? { type: 'RESULT', id: 'permission', ok: true, payload: { status: 'denied' } }
          : { type: 'RESULT', id: 'permission', ok: false, error: 'push-not-configured' },
      );
    renderWithProviders(<PushPermissionSheet />, { searchParams: '?overlay=push-permission' });
    await userEvent.click(await screen.findByRole('button', { name: '알림 허용하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      status === 'denied'
        ? '푸시 권한을 허용해야 Android 알림을 받을 수 있어요.'
        : '푸시 알림 권한을 요청하지 못했어요.',
    );
    expect(screen.getByRole('dialog')).toBeVisible();
  },
);

it('does not close another sheet when a permission response arrives after dismissal', async () => {
  let finish!: (value: Awaited<ReturnType<typeof requestNative>>) => void;
  vi.mocked(requestNative).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  renderWithProviders(
    <>
      <PushPermissionSheet />
      <OtherOverlayControls />
    </>,
    {
      searchParams: '?overlay=push-permission',
    },
  );
  await userEvent.click(await screen.findByRole('button', { name: '알림 허용하기' }));
  expect(screen.getByRole('button', { name: '권한 확인 중…' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: '나중에' }));
  await userEvent.click(screen.getByRole('button', { name: '다른 시트 열기' }));
  await act(async () => {
    finish({ type: 'RESULT', id: 'permission', ok: true, payload: { status: 'granted' } });
  });
  expect(screen.getByTestId('overlay')).toHaveTextContent('report');
});
