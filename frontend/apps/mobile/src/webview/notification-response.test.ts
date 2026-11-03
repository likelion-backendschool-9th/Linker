import type { NotificationResponse } from 'expo-notifications';
import { describe, expect, it, vi } from 'vitest';

import { createNotificationReceiver } from './notification-response';

function response(identifier: string, path: string): NotificationResponse {
  return {
    actionIdentifier: 'default',
    notification: {
      date: 0,
      request: {
        identifier,
        trigger: null,
        content: {
          title: null,
          subtitle: null,
          body: null,
          categoryIdentifier: null,
          sound: null,
          threadIdentifier: null,
          data: { path },
        },
      },
    },
  };
}

describe('notification taps', () => {
  it('consumes a tap only once across initial-response and running-listener delivery', () => {
    const open = vi.fn(),
      clear = vi.fn();
    const receive = createNotificationReceiver(open, clear);
    receive(response('n1', '/chats/1'));
    receive(response('n1', '/chats/1'));
    expect(open).toHaveBeenCalledExactlyOnceWith('/chats/1');
    expect(clear).toHaveBeenCalledOnce();
  });

  it('allows another notification with the same destination', () => {
    const open = vi.fn();
    const receive = createNotificationReceiver(open, vi.fn());
    receive(response('n1', '/chats/1'));
    receive(response('n2', '/chats/1'));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('ignores empty responses and discards unsafe native launch destinations', () => {
    const open = vi.fn(),
      clear = vi.fn();
    const receive = createNotificationReceiver(open, clear);
    receive(null);
    receive(response('n1', '//evil.test'));
    receive(response('n2', '/\\evil.test'));
    expect(open).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledTimes(2);
  });
});
