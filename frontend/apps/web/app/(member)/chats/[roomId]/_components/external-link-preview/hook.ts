'use client';

import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { firstExternalUrl } from '@/features/share/message-links';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { useViewer } from '@/lib/auth/viewer-context';
import { linkPreviewOptions } from './api';

const subscribe = () => () => {};
const clientOrigin = () => window.location.origin;
const serverOrigin = () => null;

export function useExternalLinkPreview(roomId: number, text: string) {
  const viewer = useViewer();
  const origin = useSyncExternalStore(subscribe, clientOrigin, serverOrigin);
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const url = origin ? firstExternalUrl(text, [origin, configuredOrigin]) : null;
  const preview = useQuery({ ...linkPreviewOptions(viewer.login, roomId, url), enabled: !!url });
  return { url, preview, openExternal: useOpenExternal() };
}
