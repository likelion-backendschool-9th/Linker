import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

const BACK_RESULT_TIMEOUT_MS = 300;
const EXIT_WINDOW_MS = 2000;

type AndroidBackOptions = {
  askWeb: (id: string) => void;
  canGoBack: () => boolean;
  goBack: () => void;
};

/**
 * Hardware back (blueprint §12-3): the web closes an open overlay first (BACK_PRESSED → BACK_RESULT);
 * otherwise go back in the WebView, and on the first screen exit on a second press within 2 s.
 */
export function useAndroidBack({ askWeb, canGoBack, goBack }: AndroidBackOptions) {
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const lastPressAt = useRef(0);
  const options = useRef({ askWeb, canGoBack, goBack });
  useEffect(() => {
    options.current = { askWeb, canGoBack, goBack };
  });

  const fallback = useCallback(() => {
    pending.current = null;
    if (options.current.canGoBack()) {
      options.current.goBack();
      return;
    }
    const now = Date.now();
    if (now - lastPressAt.current < EXIT_WINDOW_MS) {
      BackHandler.exitApp();
      return;
    }
    lastPressAt.current = now;
    ToastAndroid.show('한 번 더 누르면 종료돼요', ToastAndroid.SHORT);
  }, []);

  /** Called by the dispatcher on BACK_RESULT */
  const onBackResult = useCallback(
    (id: string, handled: boolean) => {
      if (pending.current?.id !== id) return;
      clearTimeout(pending.current.timer);
      if (handled) pending.current = null;
      else fallback();
    },
    [fallback],
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pending.current) return true;
      const id = String(Date.now());
      // No reply in 300 ms (web not ready, page crashed): handle natively
      pending.current = { id, timer: setTimeout(fallback, BACK_RESULT_TIMEOUT_MS) };
      options.current.askWeb(id);
      return true;
    });
    return () => subscription.remove();
  }, [fallback]);

  return { onBackResult };
}
