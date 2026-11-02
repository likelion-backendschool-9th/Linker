import { SafeAreaView } from 'react-native-safe-area-context';

import { LinkerWebView } from '@/webview/linker-webview';

// Only screen of the app (blueprint ch. 12). Background matches the web's --color-canvas.
export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <LinkerWebView />
    </SafeAreaView>
  );
}
