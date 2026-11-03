import { apiFetch } from '@/lib/api/api-fetch';

import { endNativeSession, registerNativePushToken, syncNativeSession } from './native-session';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

describe('native account and device lifecycle', () => {
  const send = vi.fn();
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset().mockResolvedValue(undefined);
    window.ReactNativeWebView = { postMessage: send };
    syncNativeSession(null);
    send.mockClear();
  });
  afterEach(() => {
    delete window.ReactNativeWebView;
  });

  it('only forwards the session identifiers and ignores guest/iOS device registration', async () => {
    await registerNativePushToken({ type: 'PUSH_TOKEN', token: 'guest', platform: 'android' });
    syncNativeSession({ userId: 1, userType: 'DEVELOPER' });
    await registerNativePushToken({ type: 'PUSH_TOKEN', token: 'ios', platform: 'ios' });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(JSON.parse(send.mock.calls[0]![0]).msg).toEqual({
      type: 'AUTH_SESSION_SAVE',
      session: { userId: 1, userType: 'DEVELOPER' },
    });
  });

  it('unbinds the device before ending the authenticated session', async () => {
    syncNativeSession({ userId: 1, userType: 'DEVELOPER' });
    await registerNativePushToken({
      type: 'PUSH_TOKEN',
      token: 'ExponentPushToken[a]',
      platform: 'android',
    });
    const logout = vi.fn(async () => {
      expect(apiFetch).toHaveBeenLastCalledWith(
        '/api/v1/user/push-tokens/ExponentPushToken%5Ba%5D',
        { method: 'DELETE' },
      );
      return 'done';
    });
    await expect(endNativeSession(logout)).resolves.toBe('done');
    await registerNativePushToken({ type: 'PUSH_TOKEN', token: 'late', platform: 'android' });
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls.at(-1)![0]).msg.type).toBe('AUTH_SESSION_CLEAR');
  });

  it('restores native account state when logout fails', async () => {
    syncNativeSession({ userId: 2, userType: 'RECRUITER' });
    await expect(
      endNativeSession(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
    expect(JSON.parse(send.mock.calls.at(-1)![0]).msg).toMatchObject({
      type: 'AUTH_SESSION_SAVE',
      session: { userId: 2 },
    });
  });

  it('waits for an in-flight token registration before deleting it', async () => {
    syncNativeSession({ userId: 1, userType: 'DEVELOPER' });
    let finish!: () => void;
    vi.mocked(apiFetch).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const registering = registerNativePushToken({
      type: 'PUSH_TOKEN',
      token: 'ExpoPushToken[pending]',
      platform: 'android',
    });
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const logout = vi.fn(async () => undefined);
    const ending = endNativeSession(logout);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
    finish();
    await registering;
    await ending;
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(logout).toHaveBeenCalledOnce();
  });
});
