import { encodeEnvelope, type NativeToWeb } from '@linker/bridge';
import { focusManager } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import { ensureConnected } from '@/lib/realtime/stomp-client';
import { registerPushToken } from '@/features/notifications/push-tokens';
import { renderWithProviders } from '@/test/render-with-providers';

import { NativeBridgeProvider } from './native-bridge-provider';

const overlay = vi.hoisted(() => ({ overlay: null as string | null, close: vi.fn() }));
vi.mock('@/lib/navigation/use-overlay', () => ({ useActiveOverlay: () => overlay }));
vi.mock('@/lib/realtime/stomp-client', () => ({ ensureConnected: vi.fn() }));
vi.mock('@/features/notifications/push-tokens', () => ({
  registerPushToken: vi.fn(async () => {}),
}));

describe('native message routing', () => {
  const router = {
    bfcacheId: 'test',
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  const send = vi.fn();
  const receive = (msg: NativeToWeb) =>
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: encodeEnvelope(msg) }));
    });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue(router);
    window.ReactNativeWebView = { postMessage: send };
    overlay.overlay = null;
  });
  afterEach(() => {
    delete window.ReactNativeWebView;
    vi.restoreAllMocks();
  });

  it('closes an active sheet before acknowledging hardware back', () => {
    overlay.overlay = 'report';
    renderWithProviders(<NativeBridgeProvider session={null}>page</NativeBridgeProvider>);
    receive({ type: 'BACK_PRESSED', id: 'back1' });
    expect(overlay.close).toHaveBeenCalledOnce();
    expect(JSON.parse(send.mock.calls.at(-1)![0]).msg).toEqual({
      type: 'BACK_RESULT',
      id: 'back1',
      handled: true,
    });
  });

  it('leaves normal history handling to the native shell and rejects external destinations', () => {
    renderWithProviders(<NativeBridgeProvider session={null}>page</NativeBridgeProvider>);
    receive({ type: 'BACK_PRESSED', id: 'back1' });
    expect(JSON.parse(send.mock.calls.at(-1)![0]).msg.handled).toBe(false);
    receive({ type: 'DEEP_LINK', path: '//evil.test' });
    expect(router.push).not.toHaveBeenCalled();
    receive({ type: 'DEEP_LINK', path: '/chats/1' });
    expect(router.push).toHaveBeenCalledWith('/chats/1');
  });

  it('synchronizes only the native session identifiers and forwards Android token messages', () => {
    renderWithProviders(
      <NativeBridgeProvider session={{ userId: 1, userType: 'DEVELOPER' }}>
        page
      </NativeBridgeProvider>,
    );
    expect(send.mock.calls.map(([raw]) => JSON.parse(raw).msg)).toContainEqual({
      type: 'AUTH_SESSION_SAVE',
      session: { userId: 1, userType: 'DEVELOPER' },
    });
    const token = { type: 'PUSH_TOKEN', token: 'ExpoPushToken[t]', platform: 'android' } as const;
    receive(token);
    expect(registerPushToken).toHaveBeenCalledWith(token.token, token.platform);
  });

  it('resets query focus in the background and reconnects on resume', () => {
    const focus = vi.spyOn(focusManager, 'setFocused');
    renderWithProviders(<NativeBridgeProvider session={null}>page</NativeBridgeProvider>);
    receive({ type: 'APP_STATE', state: 'background' });
    expect(focus).toHaveBeenLastCalledWith(false);
    expect(ensureConnected).not.toHaveBeenCalled();
    receive({ type: 'APP_STATE', state: 'active' });
    expect(focus).toHaveBeenLastCalledWith(true);
    expect(ensureConnected).toHaveBeenCalledOnce();
  });
});
