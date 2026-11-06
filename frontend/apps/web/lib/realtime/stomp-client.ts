import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';

/**
 * One STOMP connection per tab (blueprint §11-1). Created lazily from effects, never at module top level.
 * The cookie authenticates the `/ws` handshake. stompjs reconnects but drops subscriptions,
 * so this module keeps a registry and resubscribes; screens resync missed messages via REST in `onResubscribe`.
 */

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting';

type Entry = {
  destination: string;
  onMessage: (body: unknown) => void;
  onResubscribe?: () => void;
  subscription?: StompSubscription;
};

const RECONNECT_DELAY_MS = 5000;
const HEARTBEAT_MS = 10_000;

let client: Client | null = null;
let connectedOnce = false;
let state: ConnectionState = 'idle';
const entries = new Set<Entry>();
const stateListeners = new Set<() => void>();

function setState(next: ConnectionState) {
  state = next;
  stateListeners.forEach((listener) => listener());
}

/** `NEXT_PUBLIC_WS_URL`, else the API origin (or this origin behind Nginx) with ws(s) and `/ws`. */
function brokerUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin;
  return `${origin.replace(/^http/, 'ws')}/ws`;
}

function parse(message: IMessage): unknown {
  try {
    return JSON.parse(message.body);
  } catch {
    return message.body;
  }
}

function attach(entry: Entry) {
  entry.subscription = client!.subscribe(entry.destination, (message) =>
    entry.onMessage(parse(message)),
  );
}

function getClient(): Client {
  if (client) return client;
  client = new Client({
    brokerURL: brokerUrl(),
    reconnectDelay: RECONNECT_DELAY_MS,
    heartbeatIncoming: HEARTBEAT_MS,
    heartbeatOutgoing: HEARTBEAT_MS,
  });
  client.onConnect = () => {
    const isReconnect = connectedOnce;
    connectedOnce = true;
    setState('connected');
    entries.forEach((entry) => {
      attach(entry);
      if (isReconnect) entry.onResubscribe?.();
    });
  };
  client.onWebSocketClose = () => {
    if (client?.active) setState(connectedOnce ? 'reconnecting' : 'connecting');
  };
  setState('connecting');
  client.activate();
  return client;
}

/** Mock mode (blueprint §1-2): no socket; an in-tab bus stands in so chat works without a server. */
function subscribeMock(entry: Omit<Entry, 'subscription'>): () => void {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;
  setState('connected');
  // The flag is written out here too: a function the bundler cannot prove unused still keeps its import
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    void import('@/mocks/mock-realtime').then((mock) => {
      if (!cancelled) unsubscribe = mock.subscribe(entry.destination, entry.onMessage);
    });
  }
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

/** Subscribes now if connected, and again after every reconnect. Returns the unsubscribe function. */
export function subscribe(entry: Omit<Entry, 'subscription'>): () => void {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') return subscribeMock(entry);
  const registered: Entry = { ...entry };
  entries.add(registered);
  const stomp = getClient();
  if (stomp.connected) attach(registered);
  return () => {
    entries.delete(registered);
    registered.subscription?.unsubscribe();
  };
}

/** SEND to an `/app/...` destination; `false` while disconnected (the caller keeps the draft). */
export function publish(destination: string, body: unknown): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    void import('@/mocks/mock-realtime').then((mock) => mock.publish(destination, body));
    return true;
  }
  if (!client?.connected) return false;
  client.publish({ destination, body: JSON.stringify(body) });
  return true;
}

/** App came back to the foreground or the network returned: reconnect if the socket died. */
export function ensureConnected() {
  if (client && !client.active) client.activate();
}

/** Logout: drop the connection and every subscription. */
export async function disconnect() {
  entries.clear();
  connectedOnce = false;
  const current = client;
  client = null;
  setState('idle');
  await current?.deactivate();
}

export function getConnectionState(): ConnectionState {
  return state;
}

export function onConnectionStateChange(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}
