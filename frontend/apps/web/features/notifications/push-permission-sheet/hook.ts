'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { isInApp } from '@/lib/bridge/native';
import { safeStorage } from '@/lib/browser/safe-storage';
import { useActiveOverlay, useOverlay } from '@/lib/navigation/use-overlay';

import { requestPushPermission } from './api';

export const PUSH_PERMISSION_SEEN_KEY = 'linker:push-permission-seen';
const UNAVAILABLE = '푸시 알림 권한을 요청하지 못했어요. 나중에 다시 시도해 주세요.';
const subscribeToEnvironment = () => () => {};
const androidSnapshot = () => isInApp() && /Android/i.test(navigator.userAgent);
const serverSnapshot = () => false;

export function usePushPermissionSheet() {
  const pathname = usePathname();
  const overlay = useOverlay('push-permission');
  const active = useActiveOverlay();
  const androidApp = useSyncExternalStore(subscribeToEnvironment, androidSnapshot, serverSnapshot);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = useRef(false);
  const requesting = useRef(false);
  const latestOverlay = useRef(overlay);

  useEffect(() => {
    latestOverlay.current = overlay;
  });

  const { isOpen, open } = overlay;
  useEffect(() => {
    if (
      !androidApp ||
      pathname === '/auth/callback' ||
      shown.current ||
      safeStorage.get(PUSH_PERMISSION_SEEN_KEY) === true
    )
      return;
    // Never replace an in-progress login, report or any other owner's sheet.
    if (active.overlay && !isOpen) return;
    if (isOpen) {
      shown.current = true;
      safeStorage.set(PUSH_PERMISSION_SEEN_KEY, true);
      return;
    }
    // nuqs may expose its optimistic close before history.replaceState has committed.
    // Wait for the prior overlay's URL and E's history bookkeeping before starting a new push.
    let frame: number;
    const openAfterClose = () => {
      if (new URLSearchParams(window.location.search).has('overlay')) {
        frame = requestAnimationFrame(openAfterClose);
        return;
      }
      shown.current = true;
      safeStorage.set(PUSH_PERMISSION_SEEN_KEY, true);
      open();
    };
    frame = requestAnimationFrame(openAfterClose);
    return () => cancelAnimationFrame(frame);
  }, [androidApp, pathname, active.overlay, isOpen, open]);

  async function requestPermission() {
    if (requesting.current) return;
    requesting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await requestPushPermission();
      const payload = result.payload;
      const status =
        result.ok && payload && typeof payload === 'object' && 'status' in payload
          ? payload.status
          : null;
      if (status === 'granted') {
        if (latestOverlay.current.isOpen) latestOverlay.current.close();
      } else
        setError(
          status === 'denied' ? '푸시 권한을 허용해야 Android 알림을 받을 수 있어요.' : UNAVAILABLE,
        );
    } catch {
      setError(UNAVAILABLE);
    } finally {
      requesting.current = false;
      setPending(false);
    }
  }

  return { androidApp, overlay, pending, error, requestPermission };
}
