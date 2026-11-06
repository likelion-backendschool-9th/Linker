import { SUBSCRIPTION_PRICE, SUBSCRIPTION_RULES } from '@/lib/policy';
import type { Payment, Subscription } from '@/features/subscription/management-api';
import type { MockViewer } from '../core/viewer';
import { dateOnly, daysAgo } from '../core/define';
import { readOrders } from './payment-orders';

/** Account-isolated mock management overrides; session persistence is mock-only. */
type RecordState = {
  subscriptions: Subscription[];
  payments: (Payment & { benefitsUsed: boolean })[];
};
const accounts = new Map<number, RecordState>();
export function state(viewer: MockViewer): RecordState {
  const userId = viewer.me!.id;
  let data = accounts.get(userId);
  if (!data && typeof window !== 'undefined') {
    try {
      data = JSON.parse(sessionStorage.getItem(`linker:mock:subscriptions:${userId}`) ?? 'null') as
        RecordState | undefined;
    } catch {
      /* optional persistence */
    }
  }
  if (!data) {
    const scout = viewer.role === 'recruiter';
    const kind = scout ? 'SCOUT' : 'PRO';
    const amount = scout ? SUBSCRIPTION_PRICE.scoutMonthly : SUBSCRIPTION_PRICE.proMonthly;
    data = {
      subscriptions: [
        {
          id: 'demo-personal',
          kind,
          name: scout ? 'Scout' : 'Pro',
          teamName: null,
          status: 'ACTIVE',
          billing: 'MONTHLY',
          nextBillingDate: dateOnly(27),
          endsOn: null,
          amount,
          nextMemberCount: null,
          billingOwner: true,
        },
      ],
      payments: [
        {
          id: 'demo-recent',
          subscriptionId: 'demo-personal',
          amount,
          status: 'PAID',
          paidAt: daysAgo(3),
          description: `${scout ? 'Scout' : 'Pro'} 월간`,
          refundable: true,
          refundReason: null,
          benefitsUsed: false,
        },
        {
          id: 'demo-old',
          subscriptionId: 'demo-personal',
          amount,
          status: 'PAID',
          paidAt: daysAgo(33),
          description: `${scout ? 'Scout' : 'Pro'} 월간`,
          refundable: false,
          refundReason: null,
          benefitsUsed: false,
        },
      ],
    };
    if (!scout) {
      data.subscriptions.push({
        id: 'demo-flex',
        kind: 'FLEX',
        name: 'Flex',
        teamName: 'Linker 해커톤팀',
        status: 'ACTIVE',
        billing: 'MONTHLY',
        nextBillingDate: dateOnly(27),
        endsOn: null,
        amount: SUBSCRIPTION_PRICE.flexMonthly,
        nextMemberCount: 5,
        billingOwner: true,
      });
      data.payments.push({
        id: 'demo-flex-payment',
        subscriptionId: 'demo-flex',
        amount: SUBSCRIPTION_PRICE.flexMonthly,
        status: 'PAID',
        paidAt: daysAgo(2),
        description: 'Flex 월간 · Linker 해커톤팀',
        refundable: false,
        refundReason: null,
        benefitsUsed: true,
      });
    }
  }
  for (const order of readOrders(viewer)) {
    if (order.state !== 'PAID' && order.state !== 'REFUNDED') continue;
    if (data.subscriptions.some((sub) => sub.id === order.orderId)) continue;
    data.subscriptions.push({
      id: order.orderId,
      kind: order.planKey,
      name: order.planKey === 'PRO' ? 'Pro' : order.planKey === 'FLEX' ? 'Flex' : 'Scout',
      teamName: order.teamId ? `팀 #${order.teamId}` : null,
      status: order.state === 'REFUNDED' ? 'ENDED' : 'ACTIVE',
      billing: order.billing,
      nextBillingDate: order.state === 'PAID' ? order.expiresOn : null,
      endsOn: order.state === 'REFUNDED' ? dateOnly(0) : null,
      amount: order.amount,
      nextMemberCount: null,
      billingOwner: true,
    });
    data.payments.unshift({
      id: order.orderId,
      subscriptionId: order.orderId,
      amount: order.amount,
      status: order.state === 'REFUNDED' ? 'REFUNDED' : 'PAID',
      paidAt: order.paidAt ?? new Date().toISOString(),
      description: `${order.planKey} ${order.billing === 'YEARLY' ? '연간' : '월간'}`,
      refundable: true,
      refundReason: null,
      benefitsUsed: false,
    });
  }
  accounts.set(userId, data);
  return data;
}
export function save(viewer: MockViewer, data: RecordState) {
  accounts.set(viewer.me!.id, data);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`linker:mock:subscriptions:${viewer.me!.id}`, JSON.stringify(data));
    } catch {
      /* optional persistence */
    }
  }
}
export function paymentView(payment: RecordState['payments'][number]): Payment {
  const { benefitsUsed, ...item } = payment;
  const expired =
    Date.now() - new Date(item.paidAt).getTime() > SUBSCRIPTION_RULES.refundWithinDays * 864e5;
  return {
    ...item,
    refundable: item.status === 'PAID' && !expired && !benefitsUsed,
    refundReason:
      item.status === 'REFUNDED'
        ? null
        : expired
          ? '결제 후 7일이 지나 환불할 수 없어요.'
          : benefitsUsed
            ? '이미 구독 혜택을 사용해 환불할 수 없어요.'
            : null,
  };
}
