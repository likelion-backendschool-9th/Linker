import type { NativeToWeb } from '@linker/bridge';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { createDispatcher } from '@/bridge/dispatcher';
import { authCallbackPath } from '@/bridge/handlers/auth';
import { sendToWeb, type WebViewHandle } from '@/bridge/send-to-web';
import { WEB_ORIGIN } from '@/lib/config';

import { navigationPolicy } from './navigation-policy';
import { useAndroidBack } from './use-android-back';

/** Path a notification carries in `data.path` (set by the server, 18) */
function notificationPath(response: Notifications.NotificationResponse | null): string | null {
  const path = response?.notification.request.content.data?.path;
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : null;
}

/**
 * The app's only screen (blueprint ch. 12): Linker web in a WebView plus the bridge.
 * Every screen is web; native handles login return, push, share, back and external links.
 */
export function LinkerWebView() {
  const webView = useRef<WebViewHandle>(null);
  const canGoBack = useRef(false);
  const webReady = useRef(false);
  // Deep links that arrive before the web sent READY (cold start from a notification)
  const heldPaths = useRef<string[]>([]);
  const [failed, setFailed] = useState(false);

  const send = useCallback((msg: NativeToWeb) => sendToWeb(webView, msg), []);

  const loadPath = useCallback((path: string) => {
    const url = JSON.stringify(`${WEB_ORIGIN}${path}`);
    webView.current?.injectJavaScript(`window.location.replace(${url}); true;`);
  }, []);

  const openPath = useCallback(
    (path: string) => {
      if (webReady.current) send({ type: 'DEEP_LINK', path });
      else heldPaths.current.push(path);
    },
    [send],
  );

  const { onBackResult } = useAndroidBack({
    askWeb: (id) => send({ type: 'BACK_PRESSED', id }),
    canGoBack: () => canGoBack.current,
    goBack: () => webView.current?.goBack(),
  });

  const onMessage = useMemo(
    () =>
      createDispatcher({
        send,
        loadPath,
        onReady: () => {
          webReady.current = true;
          heldPaths.current.splice(0).forEach((path) => send({ type: 'DEEP_LINK', path }));
        },
        onBackResult,
      }),
    [send, loadPath, onBackResult],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background') send({ type: 'APP_STATE', state });
    });
    return () => subscription.remove();
  }, [send]);

  // Notification tap: cold start and while running
  useEffect(() => {
    const initial = notificationPath(Notifications.getLastNotificationResponse());
    if (initial) openPath(initial);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const path = notificationPath(response);
      if (path) openPath(path);
    });
    return () => subscription.remove();
  }, [openPath]);

  // `linker://auth?…` opened outside the auth session (the web callback handed off from the system browser)
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const path = authCallbackPath(url);
      if (path) loadPath(path);
    });
    return () => subscription.remove();
  }, [loadPath]);

  if (failed) {
    return (
      <View style={styles.retry}>
        <Text style={styles.retryText}>Linker를 불러오지 못했어요.</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.retryButton}
          onPress={() => setFailed(false)}
        >
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <WebView
      ref={webView}
      source={{ uri: WEB_ORIGIN }}
      originWhitelist={[WEB_ORIGIN]}
      onShouldStartLoadWithRequest={navigationPolicy}
      onMessage={onMessage}
      onNavigationStateChange={(state) => {
        canGoBack.current = state.canGoBack;
      }}
      onLoadStart={() => {
        webReady.current = false;
      }}
      onError={() => setFailed(true)}
      onContentProcessDidTerminate={() => webView.current?.reload()}
      onRenderProcessGone={() => webView.current?.reload()}
      sharedCookiesEnabled
      applicationNameForUserAgent="LinkerApp/1"
      allowsBackForwardNavigationGestures
      pullToRefreshEnabled={false}
    />
  );
}

// The one native screen; colors match the web tokens (--color-canvas, --color-primary, --color-text-body)
const styles = StyleSheet.create({
  retry: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#ffffff',
  },
  retryText: { fontSize: 16, color: '#404040' },
  retryButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: '#141414',
  },
  retryButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
});
