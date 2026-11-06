import type { MockViewer } from '../core/viewer';
import { fail } from '../core/define';

// Mock orders survive provider callbacks/reloads within this browser tab. No real payment data is stored.
export type Order = {
  orderId: string;
  userId: number;
  amount: number;
  planKey: 'PRO' | 'FLEX' | 'SCOUT';
  billing: 'MONTHLY' | 'YEARLY';
  teamId: number | null;
  state: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paidAt?: string;
  expiresOn: string;
};
const orders = new Map<string, Order>();
export function readOrders(viewer: MockViewer): Order[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(
        sessionStorage.getItem(`linker:mock:orders:${viewer.me!.id}`) ?? '[]',
      ) as Order[];
      if (Array.isArray(stored))
        for (const order of stored)
          if (order.userId === viewer.me!.id && !orders.has(order.orderId))
            orders.set(order.orderId, order);
    } catch {
      /* In-memory flow remains available when storage is disabled. */
    }
  }
  return [...orders.values()].filter((order) => order.userId === viewer.me!.id);
}
export function saveOrder(order: Order) {
  orders.set(order.orderId, order);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(
        `linker:mock:orders:${order.userId}`,
        JSON.stringify([...orders.values()].filter((item) => item.userId === order.userId)),
      );
    } catch {
      /* optional persistence */
    }
  }
}
export function ownOrder(viewer: MockViewer, id: string): Order {
  const order = readOrders(viewer).find((item) => item.orderId === id);
  if (!order) fail(404, 'ORDER_NOT_FOUND', '주문을 찾지 못했어요.');
  return order;
}
