'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { useDraft } from '@/features/draft-restore/use-draft';
import { publish } from '@/lib/realtime/stomp-client';

import { MessageOutbox, type PendingMessage } from '../_lib/message-outbox';

export function useMessageOutbox(roomId: number, login: string | null) {
  const stored = useDraft<PendingMessage[]>(`draft:chat:${login}:${roomId}:outbox`);
  const [outbox] = useState(
    () =>
      new MessageOutbox((item) =>
        publish(`/app/chat-rooms/${roomId}/messages`, {
          clientMessageId: item.clientMessageId,
          text: item.text,
        }),
      ),
  );
  const pending = useSyncExternalStore(outbox.subscribe, outbox.getSnapshot, outbox.getSnapshot);
  useEffect(() => {
    outbox.restore(stored.load() ?? []);
    const unsubscribe = outbox.subscribe(() => {
      const items = outbox.getSnapshot();
      if (items.length) stored.save(items);
      else stored.clear();
    });
    return () => {
      unsubscribe();
      outbox.dispose();
    };
  }, [outbox, stored]);
  return { outbox, pending };
}
