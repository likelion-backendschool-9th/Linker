import { Linking } from 'react-native';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { isWebOrigin } from '@/lib/config';

/** Only Linker stays in the WebView; https elsewhere goes to the system browser (blueprint §12-1). */
export function navigationPolicy(request: ShouldStartLoadRequest): boolean {
  const { url } = request;
  if (isWebOrigin(url) || url === 'about:blank') return true;
  if (url.startsWith('https://')) void Linking.openURL(url);
  return false;
}
