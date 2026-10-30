import { daysAgo, fail, get, post, type MockRoute } from '../core/define';

/** 29 Manage subscription: `SubscriptionManageController` */

type Sub = {
  id: number;
  kind: 'PRO' | 'FLEX' | 'SCOUT';
  name: string;
  teamName: string | null;
  status: 'ACTIVE' | 'CANCELING' | 'ENDED';
  billing: 'MONTHLY' | 'YEARLY';
  nextBillingDate: string | null;
  endsOn: string | null;
  amount: number;
  /** Flex: next headcount and amount (POL ch. 11) */
  nextMemberCount: number | null;
  billingOwner: boolean;
};

const developerSubs: Sub[] = [
  {
    id: 1,
    kind: 'PRO',
    name: 'Pro',
    teamName: null,
    status: 'ACTIVE',
    billing: 'MONTHLY',
    nextBillingDate: '2026-11-28',
    endsOn: null,
    amount: 2900,
    nextMemberCount: null,
    billingOwner: true,
  },
  {
    id: 2,
    kind: 'FLEX',
    name: 'Flex',
    teamName: 'Linker 해커톤팀',
    status: 'ACTIVE',
    billing: 'MONTHLY',
    nextBillingDate: '2026-11-12',
    endsOn: null,
    amount: 7900,
    nextMemberCount: 5,
    billingOwner: true,
  },
];
const recruiterSubs: Sub[] = [
  {
    id: 3,
    kind: 'SCOUT',
    name: 'Scout',
    teamName: null,
    status: 'ACTIVE',
    billing: 'MONTHLY',
    nextBillingDate: '2026-11-20',
    endsOn: null,
    amount: 14900,
    nextMemberCount: null,
    billingOwner: true,
  },
];

type Payment = {
  id: number;
  subscriptionId: number;
  amount: number;
  status: 'PAID' | 'REFUNDED';
  paidAt: string;
  description: string;
};
const payments: Payment[] = [
  {
    id: 1,
    subscriptionId: 1,
    amount: 2900,
    status: 'PAID',
    paidAt: daysAgo(3),
    description: 'Pro 월간',
  },
  {
    id: 2,
    subscriptionId: 2,
    amount: 7900,
    status: 'PAID',
    paidAt: daysAgo(19),
    description: 'Flex 월간 · Linker 해커톤팀',
  },
  {
    id: 3,
    subscriptionId: 1,
    amount: 2900,
    status: 'PAID',
    paidAt: daysAgo(33),
    description: 'Pro 월간',
  },
  {
    id: 4,
    subscriptionId: 3,
    amount: 14900,
    status: 'PAID',
    paidAt: daysAgo(11),
    description: 'Scout 월간',
  },
];

const subsFor = (role: string) => (role === 'recruiter' ? recruiterSubs : developerSubs);
const findSub = (id: string) =>
  [...developerSubs, ...recruiterSubs].find((s) => s.id === Number(id));

export const routes: MockRoute[] = [
  get('/api/v1/user/me/subscriptions', ({ viewer }) => ({ items: subsFor(viewer.role) })),
  get('/api/v1/user/me/payments', ({ viewer }) => {
    const ids = subsFor(viewer.role).map((s) => s.id);
    return {
      items: payments
        .filter((p) => ids.includes(p.subscriptionId))
        .map((p) => ({
          ...p,
          // Full refund within 7 days when benefits are unused (POL ch. 11)
          refundable: p.status === 'PAID' && Date.now() - new Date(p.paidAt).getTime() < 7 * 864e5,
        })),
    };
  }),
  // Benefits stay until the paid period ends; no pro-rated refund
  post('/api/v1/user/me/subscriptions/:subscriptionId/cancel', ({ params }) => {
    const sub = findSub(params.subscriptionId!);
    if (!sub) fail(404, 'NOT_FOUND', '구독을 찾지 못했어요');
    sub.status = 'CANCELING';
    sub.endsOn = sub.nextBillingDate;
    sub.nextBillingDate = null;
    return sub;
  }),
  post('/api/v1/user/me/payments/:paymentId/refund', ({ params }) => {
    const payment = payments.find((p) => p.id === Number(params.paymentId));
    if (!payment) fail(404, 'NOT_FOUND', '결제 내역을 찾지 못했어요');
    if (Date.now() - new Date(payment.paidAt).getTime() >= 7 * 864e5) {
      fail(409, 'REFUND_EXPIRED', '결제 후 7일이 지나 환불할 수 없어요');
    }
    payment.status = 'REFUNDED';
    return payment;
  }),
  post(
    '/api/v1/user/me/subscriptions/:subscriptionId/billing-owner',
    ({ params }) => {
      const sub = findSub(params.subscriptionId!);
      if (sub) sub.billingOwner = false;
      return undefined;
    },
    { only: 'developer' },
  ),
];
