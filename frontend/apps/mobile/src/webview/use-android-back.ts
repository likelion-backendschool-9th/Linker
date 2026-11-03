import { useEffect, useMemo, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

import { createAndroidBack } from './android-back';

type AndroidBackOptions = {
  askWeb: (id: string) => void;
  canGoBack: () => boolean;
  goBack: () => void;
};

/** Subscribe once; callbacks always read the current WebView navigation state. */
export function useAndroidBack(options: AndroidBackOptions) {
  const current = useRef(options);
  useEffect(() => {
    current.current = options;
  });
  const controller = useMemo(
    () =>
      createAndroidBack({
        askWeb: (id) => current.current.askWeb(id),
        canGoBack: () => current.current.canGoBack(),
        goBack: () => current.current.goBack(),
        exit: () => BackHandler.exitApp(),
        notify: () => ToastAndroid.show('한 번 더 누르면 종료돼요', ToastAndroid.SHORT),
      }),
    [],
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', controller.press);
    return () => {
      subscription.remove();
      controller.dispose();
    };
  }, [controller]);

  return { onBackResult: controller.onBackResult };
}
