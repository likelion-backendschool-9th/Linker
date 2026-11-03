import { describe, expect, it, vi } from 'vitest';

import { createWebNavigation } from './web-navigation';

describe('WebView READY and incoming destinations', () => {
  function setup() {
    const actions = { send: vi.fn(), replace: vi.fn() };
    return { ...actions, navigation: createWebNavigation(actions) };
  }

  it('holds a cold-start login return until the web is ready', () => {
    const { navigation, replace } = setup();
    navigation.loadPath('/auth/callback?code=c&state=s');
    expect(replace).not.toHaveBeenCalled();
    navigation.onReady();
    expect(replace).toHaveBeenCalledWith('/auth/callback?code=c&state=s');
  });

  it('does not exchange the same auth code twice when both Expo listeners return it', () => {
    const { navigation, replace } = setup();
    navigation.onReady();
    navigation.loadPath('/auth/callback?code=c&state=s');
    navigation.loadPath('/auth/callback?code=c&state=s');
    navigation.onReady();
    expect(replace).toHaveBeenCalledOnce();
  });

  it('keeps the web ready after an Android SPA history event so a warm login return can load', () => {
    const { navigation, replace } = setup();
    navigation.onReady();
    navigation.onLoadStart(false);
    navigation.loadPath('/auth/callback?code=warm&state=s');
    expect(replace).toHaveBeenCalledExactlyOnceWith('/auth/callback?code=warm&state=s');
  });

  it('queues the latest notification while loading and flushes it just once', () => {
    const { navigation, send } = setup();
    navigation.openPath('/chats/1');
    navigation.openPath('/chats/2');
    navigation.onReady();
    navigation.onReady();
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'DEEP_LINK', path: '/chats/2' });
    navigation.onLoadStart();
    navigation.openPath('/chats/3');
    expect(send).toHaveBeenCalledOnce();
    navigation.onReady();
    expect(send).toHaveBeenLastCalledWith({ type: 'DEEP_LINK', path: '/chats/3' });
  });

  it('waits for the callback document READY before delivering another destination', () => {
    const { navigation, send, replace } = setup();
    navigation.openPath('/chats/1');
    navigation.loadPath('/auth/callback?code=c&state=s');
    navigation.onReady();
    expect(replace).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    navigation.onReady();
    expect(send).toHaveBeenCalledOnce();
  });

  it('never queues or loads external/ambiguous paths', () => {
    const { navigation, send, replace } = setup();
    navigation.openPath('//evil.test');
    navigation.loadPath('/\\evil.test');
    navigation.onReady();
    expect(send).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
