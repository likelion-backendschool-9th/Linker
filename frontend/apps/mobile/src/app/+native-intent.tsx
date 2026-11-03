/**
 * Every app link enters the single WebView screen, never an Expo page such as /auth.
 * LinkerWebView reads the original Linking URL and validates the auth callback itself.
 */
export function redirectSystemPath() {
  return '/';
}
