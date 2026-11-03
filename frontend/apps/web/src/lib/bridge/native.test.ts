import { encodeEnvelope } from '@linker/bridge';

import { onNativeMessage, postToNative, requestNative } from './native';

describe('web bridge requests', () => {
  afterEach(() => {
    delete window.ReactNativeWebView;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not install browser listeners when no app exists', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    expect(postToNative({ type: 'READY' })).toBe(false);
    await expect(requestNative({ type: 'PUSH_PERMISSION_REQUEST' })).rejects.toThrow('not-in-app');
    expect(add).not.toHaveBeenCalled();
  });

  it('matches results by ID and removes the listener after success', async () => {
    const send = vi.fn();
    window.ReactNativeWebView = { postMessage: send };
    const remove = vi.spyOn(window, 'removeEventListener');
    const request = requestNative({ type: 'PUSH_PERMISSION_REQUEST' });
    const { msg } = JSON.parse(send.mock.calls[0]![0]);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: encodeEnvelope({ type: 'RESULT', id: 'other', ok: true }),
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: encodeEnvelope({
          type: 'RESULT',
          id: msg.id,
          ok: true,
          payload: { status: 'granted' },
        }),
      }),
    );
    await expect(request).resolves.toMatchObject({ id: msg.id, ok: true });
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('times out normal requests and cleans up after a transport exception', async () => {
    vi.useFakeTimers();
    window.ReactNativeWebView = { postMessage: vi.fn() };
    const request = expect(requestNative({ type: 'PUSH_PERMISSION_REQUEST' })).rejects.toThrow(
      'timeout',
    );
    await vi.advanceTimersByTimeAsync(5000);
    await request;
    window.ReactNativeWebView.postMessage = () => {
      throw new Error('transport');
    };
    await expect(requestNative({ type: 'PUSH_PERMISSION_REQUEST' })).rejects.toThrow('transport');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores foreign-window and malformed messages', () => {
    const handler = vi.fn();
    const unsubscribe = onNativeMessage(handler);
    window.dispatchEvent(new MessageEvent('message', { data: 'not-json' }));
    window.dispatchEvent(
      new MessageEvent('message', {
        source: {} as Window,
        data: encodeEnvelope({ type: 'BACK_PRESSED', id: 'b' }),
      }),
    );
    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('rejects malformed outbound auth requests immediately instead of waiting forever', async () => {
    const send = vi.fn();
    window.ReactNativeWebView = { postMessage: send };
    await expect(
      requestNative({ type: 'AUTH_GITHUB_START', authorizeUrl: '/relative-url' }, { timeoutMs: 0 }),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['SHARE', 'PUSH_PERMISSION_REQUEST'] as const)(
    'lets %s system UI take longer than five seconds',
    async (type) => {
      vi.useFakeTimers();
      const send = vi.fn();
      window.ReactNativeWebView = { postMessage: send };
      const message =
        type === 'SHARE'
          ? { type, title: '초대', url: 'https://linker.test/invite/demo' }
          : { type };
      const settled = vi.fn();
      const request = requestNative(message, { timeoutMs: 0 });
      void request.then(settled);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(settled).not.toHaveBeenCalled();
      const { msg } = JSON.parse(send.mock.calls[0]![0]);
      window.dispatchEvent(
        new MessageEvent('message', {
          data: encodeEnvelope({
            type: 'RESULT',
            id: msg.id,
            ok: true,
            payload: { status: 'granted' },
          }),
        }),
      );
      await expect(request).resolves.toMatchObject({ id: msg.id, ok: true });
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
