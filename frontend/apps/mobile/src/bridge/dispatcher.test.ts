import { encodeEnvelope, type WebToNative } from '@linker/bridge';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { BackHandler, Linking, Platform, Share } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WEB_ORIGIN } from '@/lib/config';

import type { BridgeContext } from './context';
import { createDispatcher } from './dispatcher';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  BackHandler: { exitApp: vi.fn() },
  Linking: { openURL: vi.fn() },
  Share: { share: vi.fn() },
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: null, easConfig: null } }));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));
vi.mock('expo-secure-store', () => ({ setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }));
vi.mock('expo-web-browser', () => ({
  openAuthSessionAsync: vi.fn(),
  WebBrowserResultType: { CANCEL: 'cancel' },
}));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

function event(msg: WebToNative, url = WEB_ORIGIN): WebViewMessageEvent {
  return { nativeEvent: { url, data: encodeEnvelope(msg) } } as WebViewMessageEvent;
}

describe('native bridge handlers', () => {
  let context: BridgeContext;
  const granted = {
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  } as Notifications.NotificationPermissionsStatus;
  beforeEach(() => {
    vi.resetAllMocks();
    Platform.OS = 'android';
    Constants.expoConfig = {
      name: 'Linker',
      slug: 'linker',
      extra: { eas: { projectId: 'test-project' } },
    };
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(granted);
    vi.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
      type: 'expo',
      data: 'ExpoPushToken[test]',
    });
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: WebBrowser.WebBrowserResultType.CANCEL,
    });
    vi.mocked(Share.share).mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    context = { send: vi.fn(), loadPath: vi.fn(), onReady: vi.fn(), onBackResult: vi.fn() };
  });

  it('rejects another origin and malformed envelopes before calling any handler', async () => {
    const dispatch = createDispatcher(context);
    await dispatch(event({ type: 'READY' }, 'https://evil.test'));
    await dispatch({ nativeEvent: { url: WEB_ORIGIN, data: '{invalid' } } as WebViewMessageEvent);
    expect(context.onReady).not.toHaveBeenCalled();
    expect(context.send).not.toHaveBeenCalled();
  });

  it('routes READY and a matched hardware-back response', async () => {
    const dispatch = createDispatcher(context);
    await dispatch(event({ type: 'READY' }));
    await dispatch(event({ type: 'BACK_RESULT', id: 'back1', handled: true }));
    expect(context.onReady).toHaveBeenCalledOnce();
    expect(context.onBackResult).toHaveBeenCalledWith('back1', true);
  });

  it('loads a valid login return in the WebView rather than saving a session token', async () => {
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: 'linker://auth?code=c&state=s',
    });
    await createDispatcher(context)(
      event({
        type: 'AUTH_GITHUB_START',
        id: 'auth1',
        authorizeUrl: 'https://github.com/login/oauth/authorize',
      }),
    );
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://github.com/login/oauth/authorize',
      'linker://auth',
    );
    expect(context.loadPath).toHaveBeenCalledExactlyOnceWith('/auth/callback?code=c&state=s');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(context.send).toHaveBeenCalledWith({ type: 'RESULT', id: 'auth1', ok: true });
  });

  it('answers auth cancellation and failure without leaving the web waiting', async () => {
    const dispatch = createDispatcher(context);
    const msg = {
      type: 'AUTH_GITHUB_START',
      id: 'auth1',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
    } as const;
    await dispatch(event(msg));
    expect(context.send).toHaveBeenLastCalledWith({
      type: 'RESULT',
      id: 'auth1',
      ok: false,
      error: 'cancelled',
    });
    vi.mocked(WebBrowser.openAuthSessionAsync).mockRejectedValueOnce(new Error('offline'));
    await dispatch(event(msg));
    expect(context.send).toHaveBeenLastCalledWith({
      type: 'RESULT',
      id: 'auth1',
      ok: false,
      error: expect.stringContaining('offline'),
    });
    expect(context.loadPath).not.toHaveBeenCalled();
  });

  it('stores only account identifiers, stripping unexpected token fields', async () => {
    const raw = {
      type: 'AUTH_SESSION_SAVE',
      session: { userId: 7, userType: 'DEVELOPER', jwt: 'never-store-this' },
    };
    await createDispatcher(context)({
      nativeEvent: { url: WEB_ORIGIN, data: JSON.stringify({ v: 1, source: 'linker', msg: raw }) },
    } as WebViewMessageEvent);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'linker.session',
      JSON.stringify({ userId: 7, userType: 'DEVELOPER' }),
    );
    expect(context.send).toHaveBeenCalledWith({
      type: 'PUSH_TOKEN',
      token: 'ExpoPushToken[test]',
      platform: 'android',
    });
    vi.mocked(context.send).mockClear();
    await createDispatcher(context)(event({ type: 'AUTH_SESSION_CLEAR' }));
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('linker.session');
    expect(context.send).not.toHaveBeenCalled();
  });

  it('finishes an older session save before clearing it, without delaying hardware back', async () => {
    let finishSave!: () => void;
    vi.mocked(SecureStore.setItemAsync).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
    );
    const dispatch = createDispatcher(context);
    const saving = dispatch(
      event({
        type: 'AUTH_SESSION_SAVE',
        session: { userId: 7, userType: 'DEVELOPER' },
      }),
    );
    await vi.waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledOnce());
    const clearing = dispatch(event({ type: 'AUTH_SESSION_CLEAR' }));
    await dispatch(event({ type: 'BACK_RESULT', id: 'back-during-save', handled: true }));
    expect(context.onBackResult).toHaveBeenCalledWith('back-during-save', true);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    finishSave();
    await Promise.all([saving, clearing]);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledOnce();
    expect(context.send).not.toHaveBeenCalled();
  });

  it('drops a late push-token response from a session cleared during token lookup', async () => {
    let finishToken!: (token: Notifications.ExpoPushToken) => void;
    vi.mocked(Notifications.getExpoPushTokenAsync).mockReturnValueOnce(
      new Promise<Notifications.ExpoPushToken>((resolve) => {
        finishToken = resolve;
      }),
    );
    const dispatch = createDispatcher(context);
    const saving = dispatch(
      event({
        type: 'AUTH_SESSION_SAVE',
        session: { userId: 7, userType: 'DEVELOPER' },
      }),
    );
    await vi.waitFor(() => expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledOnce());
    await dispatch(event({ type: 'AUTH_SESSION_CLEAR' }));
    finishToken({ type: 'expo', data: 'ExpoPushToken[old-session]' });
    await saving;
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledOnce();
    expect(context.send).not.toHaveBeenCalled();
  });

  it('keeps account-switch writes ordered even when the WebView recreates its dispatcher', async () => {
    let finishSave!: () => void;
    vi.mocked(SecureStore.setItemAsync).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
    );
    const oldSave = createDispatcher(context)(
      event({
        type: 'AUTH_SESSION_SAVE',
        session: { userId: 7, userType: 'DEVELOPER' },
      }),
    );
    await vi.waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledOnce());
    const newSave = createDispatcher(context)(
      event({
        type: 'AUTH_SESSION_SAVE',
        session: { userId: 8, userType: 'RECRUITER' },
      }),
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledOnce();
    finishSave();
    await Promise.all([oldSave, newSave]);
    expect(SecureStore.setItemAsync).toHaveBeenNthCalledWith(
      2,
      'linker.session',
      JSON.stringify({ userId: 8, userType: 'RECRUITER' }),
    );
    expect(context.send).toHaveBeenCalledExactlyOnceWith({
      type: 'PUSH_TOKEN',
      token: 'ExpoPushToken[test]',
      platform: 'android',
    });
  });

  it('still applies a new session after an older SecureStore write fails', async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('storage unavailable'));
    const dispatch = createDispatcher(context);
    await dispatch(
      event({
        type: 'AUTH_SESSION_SAVE',
        session: { userId: 7, userType: 'DEVELOPER' },
      }),
    );
    await dispatch(event({ type: 'AUTH_SESSION_CLEAR' }));
    await dispatch(
      event({
        type: 'AUTH_SESSION_SAVE',
        session: { userId: 8, userType: 'RECRUITER' },
      }),
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledOnce();
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(
      'linker.session',
      JSON.stringify({ userId: 8, userType: 'RECRUITER' }),
    );
    expect(context.send).toHaveBeenCalledExactlyOnceWith({
      type: 'PUSH_TOKEN',
      token: 'ExpoPushToken[test]',
      platform: 'android',
    });
  });

  it('creates the Android channel before permission and returns an Expo token', async () => {
    await createDispatcher(context)(event({ type: 'PUSH_PERMISSION_REQUEST', id: 'push1' }));
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', {
      name: 'Linker',
      importance: 3,
    });
    expect(
      vi.mocked(Notifications.setNotificationChannelAsync).mock.invocationCallOrder[0]!,
    ).toBeLessThan(vi.mocked(Notifications.requestPermissionsAsync).mock.invocationCallOrder[0]!);
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project' });
    expect(context.send).toHaveBeenLastCalledWith({
      type: 'RESULT',
      id: 'push1',
      ok: true,
      payload: { status: 'granted' },
    });
  });

  it('does not mint a token when permission is denied', async () => {
    const denied = {
      ...granted,
      status: 'denied',
      granted: false,
    } as Notifications.NotificationPermissionsStatus;
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(denied);
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied);
    await createDispatcher(context)(event({ type: 'PUSH_PERMISSION_REQUEST', id: 'push1' }));
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(context.send).toHaveBeenLastCalledWith({
      type: 'RESULT',
      id: 'push1',
      ok: true,
      payload: { status: 'denied' },
    });
  });

  it('reports missing push configuration without asking for unusable permissions', async () => {
    Constants.expoConfig = { name: 'Linker', slug: 'linker' };
    await createDispatcher(context)(event({ type: 'PUSH_PERMISSION_REQUEST', id: 'push1' }));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(context.send).toHaveBeenCalledWith({
      type: 'RESULT',
      id: 'push1',
      ok: false,
      error: 'push-not-configured',
    });
  });

  it('supports neither push registration nor app exit on iOS', async () => {
    Platform.OS = 'ios';
    const dispatch = createDispatcher(context);
    await dispatch(event({ type: 'EXIT_APP' }));
    await dispatch(event({ type: 'PUSH_PERMISSION_REQUEST', id: 'push1' }));
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(context.send).toHaveBeenCalledWith({
      type: 'RESULT',
      id: 'push1',
      ok: true,
      payload: { status: 'unsupported' },
    });
  });

  it('opens HTTPS links and shares with a result, including native share failure', async () => {
    const dispatch = createDispatcher(context);
    await dispatch(event({ type: 'OPEN_EXTERNAL', url: 'https://github.com/Linker' }));
    expect(Linking.openURL).toHaveBeenCalledWith('https://github.com/Linker');
    const msg = {
      type: 'SHARE',
      id: 'share1',
      title: '팀 초대',
      url: 'https://linker.test/invite/demo',
    } as const;
    await dispatch(event(msg));
    expect(context.send).toHaveBeenLastCalledWith({
      type: 'RESULT',
      id: 'share1',
      ok: true,
      payload: { action: 'sharedAction' },
    });
    vi.mocked(Share.share).mockRejectedValueOnce(new Error('unavailable'));
    await dispatch(event(msg));
    expect(context.send).toHaveBeenLastCalledWith({
      type: 'RESULT',
      id: 'share1',
      ok: false,
      error: expect.any(String),
    });
  });
});
