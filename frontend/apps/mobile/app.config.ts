import type { ExpoConfig } from 'expo/config';

// Development build only; no store release (CLAUDE.md)
const config: ExpoConfig = {
  name: 'Linker',
  slug: 'linker',
  scheme: 'linker',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.linker.app',
    supportsTablet: true,
  },
  android: {
    package: 'com.linker.app',
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: ['expo-router', 'expo-web-browser', 'expo-secure-store', 'expo-notifications'],
};

export default config;
