'use client';

import { focusManager } from '@tanstack/react-query';
import type { BridgeSession } from '@linker/bridge';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

import { registerPushToken } from '@/features/notifications/push-tokens';
import { syncNativeSession } from '@/features/auth/sync-native-session';
import { safeReturnTo } from '@/lib/auth/return-to';
import { useActiveOverlay } from '@/lib/navigation/use-overlay';
import { ensureConnected } from '@/lib/realtime/stomp-client';

import { isInApp, onNativeMessage, postToNative } from './native';

/** Handles app → web messages (blueprint §11-3). Does nothing in a plain browser. */
export function NativeBridgeProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: BridgeSession | null;
}) {
  const router = useRouter();
  const activeOverlay = useActiveOverlay();
  // The listener is registered once; read the latest overlay state through a ref
  const overlayRef = useRef(activeOverlay);
  useEffect(() => {
    overlayRef.current = activeOverlay;
  });

  useEffect(() => {
    if (!isInApp()) return;
    const unsubscribe = onNativeMessage((msg) => {
      switch (msg.type) {
        case 'BACK_PRESSED': {
          const { overlay, close } = overlayRef.current;
          if (overlay) close();
          postToNative({ type: 'BACK_RESULT', id: msg.id, handled: overlay !== null });
          break;
        }
        case 'DEEP_LINK':
          router.push(safeReturnTo(msg.path) as Route);
          break;
        case 'APP_STATE':
          focusManager.setFocused(msg.state === 'active');
          if (msg.state === 'active') {
            ensureConnected();
          }
          break;
        case 'PUSH_TOKEN':
          void registerPushToken(msg.token, msg.platform).catch(() => {
            // Keep listening; a later login or permission grant can retry.
          });
          break;
        case 'RESULT':
          // Answered through requestNative()
          break;
      }
    });
    postToNative({ type: 'READY' });
    return unsubscribe;
  }, [router]);

  const userId = session?.userId;
  const userType = session?.userType;
  useEffect(() => {
    if (!isInApp()) return;
    syncNativeSession(userId && userType ? { userId, userType } : null);
  }, [userId, userType]);

  return children;
}
