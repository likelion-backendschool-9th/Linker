import type { UploadedImage } from '@/features/image-upload/upload-image';
import { CHAT } from '@/lib/policy';

export type PendingMessage = {
  clientMessageId: string;
  text: string;
  /** Optional for compatibility with text-only drafts saved before image support. */
  images?: UploadedImage[];
  createdAt: string;
  status: 'queued' | 'sending' | 'failed';
};
type Options = { ackTimeoutMs?: number; retryDelayMs?: number };

/** ACK by clientMessageId, bounded retry, and a paced send queue; no socket is opened here. */
export class MessageOutbox {
  private snapshot: PendingMessage[] = [];
  private listeners = new Set<() => void>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private attempts = new Map<string, number>();
  private nextSendAt = 0;
  constructor(
    private send: (item: PendingMessage) => boolean,
    private options: Options = {},
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(items: PendingMessage[]) {
    this.snapshot = items;
    this.listeners.forEach((listener) => listener());
  }
  private change(id: string, status: PendingMessage['status']) {
    this.update(
      this.snapshot.map((item) => (item.clientMessageId === id ? { ...item, status } : item)),
    );
  }
  restore(items: PendingMessage[]) {
    if (this.snapshot.length) return;
    this.update(items.map((item) => ({ ...item, status: 'failed' })));
  }
  enqueue(item: Omit<PendingMessage, 'status'>) {
    if (this.snapshot.some((entry) => entry.clientMessageId === item.clientMessageId)) return;
    this.update([...this.snapshot, { ...item, status: 'queued' }]);
    this.schedule(item.clientMessageId, 0);
  }
  acknowledge = (id: string) => {
    if (!this.snapshot.some((item) => item.clientMessageId === id)) return;
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.attempts.delete(id);
    this.update(this.snapshot.filter((item) => item.clientMessageId !== id));
  };
  discard = this.acknowledge;
  retry = (id: string) => {
    if (!this.snapshot.some((item) => item.clientMessageId === id && item.status === 'failed'))
      return;
    this.attempts.set(id, 0);
    this.change(id, 'queued');
    this.schedule(id, 0);
  };
  private schedule(id: string, delay: number) {
    clearTimeout(this.timers.get(id));
    const at = Math.max(Date.now() + delay, this.nextSendAt);
    this.nextSendAt = at + 1000 / CHAT.sendsPerSecond;
    this.timers.set(
      id,
      setTimeout(() => this.attempt(id), Math.max(0, at - Date.now())),
    );
  }
  private attempt(id: string) {
    const item = this.snapshot.find((entry) => entry.clientMessageId === id);
    if (!item) return;
    this.attempts.set(id, (this.attempts.get(id) ?? 0) + 1);
    this.change(id, 'sending');
    this.timers.set(
      id,
      setTimeout(() => this.failed(id), this.options.ackTimeoutMs ?? 10_000),
    );
    try {
      if (!this.send(item)) this.failed(id);
    } catch {
      this.failed(id);
    }
  }
  private failed(id: string) {
    if (!this.snapshot.some((item) => item.clientMessageId === id)) return;
    clearTimeout(this.timers.get(id));
    if ((this.attempts.get(id) ?? 0) <= CHAT.autoRetries) {
      this.change(id, 'queued');
      this.schedule(id, this.options.retryDelayMs ?? 1000);
    } else {
      this.timers.delete(id);
      this.change(id, 'failed');
    }
  }
  dispose = () => {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  };
}
