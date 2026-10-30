import type { BridgeSession } from '@linker/bridge';
import * as SecureStore from 'expo-secure-store';

/** The app keeps only `userId` / `userType`; the session itself lives in the WebView cookie store (blueprint ch. 15). */
const SESSION_KEY = 'linker.session';

export async function saveSession(session: BridgeSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<BridgeSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  return raw ? (JSON.parse(raw) as BridgeSession) : null;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
