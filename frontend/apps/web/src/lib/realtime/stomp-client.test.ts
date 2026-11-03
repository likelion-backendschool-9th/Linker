const clients: Array<{
  connected: boolean;
  active: boolean;
  onConnect?: () => void;
  subscribe: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@stomp/stompjs', () => ({
  Client: class {
    connected = false;
    active = false;
    onConnect?: () => void;
    subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
    publish = vi.fn();
    /** Matches stompjs: activate returns before the socket is up. */
    activate = vi.fn(() => {
      this.active = true;
      queueMicrotask(() => {
        this.connected = true;
        this.onConnect?.();
      });
    });
    deactivate = vi.fn(async () => {
      this.active = false;
      this.connected = false;
    });
    constructor() {
      clients.push(this as (typeof clients)[number]);
    }
  },
}));

async function load() {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
  return import('./stomp-client');
}

async function flushConnect() {
  await Promise.resolve();
}

beforeEach(() => {
  clients.length = 0;
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
});

afterEach(async () => {
  const { disconnect } = await import('./stomp-client');
  await disconnect();
  vi.unstubAllEnvs();
});

it('subscribes when connected and removes the registry entry on cleanup', async () => {
  const { subscribe, getConnectionState } = await load();
  const onMessage = vi.fn();
  const unsubscribe = subscribe({ destination: '/topic/chat-rooms/1', onMessage });
  await flushConnect();

  expect(getConnectionState()).toBe('connected');
  expect(clients).toHaveLength(1);
  expect(clients[0].subscribe).toHaveBeenCalledTimes(1);
  expect(clients[0].subscribe).toHaveBeenCalledWith('/topic/chat-rooms/1', expect.any(Function));

  const sub = clients[0].subscribe.mock.results[0]?.value as { unsubscribe: ReturnType<typeof vi.fn> };
  unsubscribe();
  expect(sub.unsubscribe).toHaveBeenCalled();
});

it('publishes only while connected', async () => {
  const { publish, subscribe, disconnect } = await load();
  expect(publish('/app/chat-rooms/1/messages', { text: 'hi' })).toBe(false);

  subscribe({ destination: '/topic/chat-rooms/1', onMessage: vi.fn() });
  await flushConnect();
  expect(publish('/app/chat-rooms/1/messages', { text: 'hi' })).toBe(true);
  expect(clients[0].publish).toHaveBeenCalledWith({
    destination: '/app/chat-rooms/1/messages',
    body: JSON.stringify({ text: 'hi' }),
  });

  await disconnect();
  expect(publish('/app/chat-rooms/1/messages', { text: 'again' })).toBe(false);
});

it('resubscribes and calls onResubscribe after reconnect', async () => {
  const { subscribe } = await load();
  const onResubscribe = vi.fn();
  subscribe({
    destination: '/user/queue/notifications',
    onMessage: vi.fn(),
    onResubscribe,
  });
  await flushConnect();

  expect(clients[0].subscribe).toHaveBeenCalledTimes(1);
  expect(onResubscribe).not.toHaveBeenCalled();

  clients[0].onConnect?.();
  expect(clients[0].subscribe).toHaveBeenCalledTimes(2);
  expect(onResubscribe).toHaveBeenCalledTimes(1);
});

it('disconnect clears state to idle so the next subscribe opens a new client', async () => {
  const { subscribe, disconnect, getConnectionState } = await load();
  subscribe({ destination: '/topic/chat-rooms/1', onMessage: vi.fn() });
  await flushConnect();
  expect(getConnectionState()).toBe('connected');

  await disconnect();
  expect(getConnectionState()).toBe('idle');
  expect(clients[0].deactivate).toHaveBeenCalled();

  subscribe({ destination: '/topic/chat-rooms/2', onMessage: vi.fn() });
  await flushConnect();
  expect(clients).toHaveLength(2);
  expect(getConnectionState()).toBe('connected');
});
