import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { WEB_ORIGIN } from '@/lib/config';

// Only screen of the app. Bridge, back handling and navigation policy come in stage 3 (blueprint ch. 12).
export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <WebView source={{ uri: WEB_ORIGIN }} sharedCookiesEnabled />
    </SafeAreaView>
  );
}
