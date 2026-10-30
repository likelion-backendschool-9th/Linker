'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import {
  getConnectionState,
  onConnectionStateChange,
  subscribe,
  type ConnectionState,
} from './stomp-client';

type SubscriptionOptions = {
  /** After a reconnect: refetch what was missed (e.g. invalidate the room's query) */
  onResubscribe?: () => void;
  enabled?: boolean;
};

/**
 * Subscribes to a destination for the component's lifetime, e.g. `/topic/chat-rooms/{roomId}`,
 * `/user/queue/notifications`. Handlers may change between renders without resubscribing.
 */
export function useStompSubscription<T>(
  destination: string,
  onMessage: (body: T) => void,
  { onResubscribe, enabled = true }: SubscriptionOptions = {},
) {
  const handlers = useRef({ onMessage, onResubscribe });
  useEffect(() => {
    handlers.current = { onMessage, onResubscribe };
  });

  useEffect(() => {
    if (!enabled) return;
    return subscribe({
      destination,
      onMessage: (body) => handlers.current.onMessage(body as T),
      onResubscribe: () => handlers.current.onResubscribe?.(),
    });
  }, [destination, enabled]);
}

/** For "연결 중…" indicators. `idle` on the server. */
export function useStompConnectionState(): ConnectionState {
  return useSyncExternalStore(onConnectionStateChange, getConnectionState, () => 'idle');
}
