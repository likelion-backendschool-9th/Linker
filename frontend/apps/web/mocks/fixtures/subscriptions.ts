import { addMonths, addYears } from 'date-fns';

import type { Payment, Subscription } from '@/features/subscription/management-api';
import { todayKst } from '@/lib/format/time';
import { SUBSCRIPTION_PRICE, SUBSCRIPTION_RULES } from '@/lib/policy';

import { daysAgo, daysFromNow, fail, newId } from '../core/define';
import type { MockViewer } from '../core/viewer';
import type { Order } from './payment-orders';
import { TEAM_MEMBERS, TEAMS } from './teams';

/**
 * Account-isolated mock of the server subscription rows (`SubscriptionService`): one row per
 * target (own Pro, or a Flex team), each payment paying one period. A payment while the row runs
 * extends it from its current end. Session persistence is mock-only.
 */
type Plan = 'PRO' | 'FLEX' | 'SCOUT';
type Row = {
  subscriptionId: number;
  planKey: Plan;
  billing: 'MONTHLY' | 'YEARLY';
  teamId: number | null;
  /** Start of the period paid by the latest DONE payment. */
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  seats: number | null;
  /** Refunded down to nothing, or expired. */
  ended: boolean;
};
type PaymentRow = Omit<Payment, 'refundable' | 'refundReason'> & {
  subscriptionId: number;
  orderId: string;
  periodStart: string;
  periodEnd: string;
};
type RecordState = { subscriptions: Row[]; payments: PaymentRow[] };

/** Policy ch. 12 copy, as the server sends it in `refundReason` and 409 bodies. */
const REFUND_COPY = {
  started: '이미 혜택이 시작된 결제는 환불할 수 없어요. 해지하면 남은 기간까지 쓸 수 있어요.',
  notLatest: '가장 최근 결제부터 환불할 수 있어요.',
  periodOver: '결제 후 7일이 지나 환불할 수 없어요.',
} as const;

const DAY = 864e5;
const LABEL: Record<Plan, string> = { PRO: 'Pro', FLEX: 'Flex', SCOUT: 'Scout' };

export const flexAmount = (members: number) =>
  SUBSCRIPTION_PRICE.flexMonthly +
  Math.max(0, members - SUBSCRIPTION_PRICE.flexIncludedSeats) * SUBSCRIPTION_PRICE.flexExtraMember;
export const teamSeats = (teamId: number) => TEAM_MEMBERS[teamId]?.length ?? 0;

const periodEnd = (start: string, billing: Row['billing']) =>
  (billing === 'YEARLY' ? addYears(start, 1) : addMonths(start, 1)).toISOString();
export const kstDate = (iso: string) => todayKst(new Date(iso));
const live = (row: Row) => !row.ended && Date.parse(row.periodEnd) > Date.now();

function payment(
  row: Row,
  input: { paymentId: number; amount: number; approvedAt: string; periodStart: string },
): PaymentRow {
  const team = row.teamId === null ? null : TEAMS.find((item) => item.id === row.teamId);
  return {
    paymentId: input.paymentId,
    subscriptionId: row.subscriptionId,
    orderId: `seed-${input.paymentId}`,
    orderName: team
      ? `Flex · ${team.name} 구독`
      : `${LABEL[row.planKey]} ${row.billing === 'YEARLY' ? '연간' : '월간'} 구독`,
    planKey: row.planKey,
    billing: row.billing,
    teamId: row.teamId,
    amount: input.amount,
    status: 'DONE',
    method: '카드',
    approvedAt: input.approvedAt,
    canceledAt: null,
    refundedAmount: 0,
    periodStart: input.periodStart,
    periodEnd: periodEnd(input.periodStart, row.billing),
  };
}

/**
 * Developer demo: Pro paid three times (too old · not the latest · refundable future period) and
 * a Flex team whose only period has started. Recruiters start free: Scout is [Included].
 */
function seed(viewer: MockViewer): RecordState {
  if (viewer.role === 'recruiter') return { subscriptions: [], payments: [] };
  const pro: Row = {
    subscriptionId: 7001,
    planKey: 'PRO',
    billing: 'MONTHLY',
    teamId: null,
    periodStart: '',
    periodEnd: '',
    cancelAtPeriodEnd: false,
    seats: null,
    ended: false,
  };
  const first = payment(pro, {
    paymentId: 7101,
    amount: SUBSCRIPTION_PRICE.proMonthly,
    approvedAt: daysAgo(33),
    periodStart: daysAgo(33),
  });
  const second = payment(pro, {
    paymentId: 7102,
    amount: SUBSCRIPTION_PRICE.proMonthly,
    approvedAt: daysAgo(3),
    periodStart: first.periodEnd,
  });
  const third = payment(pro, {
    paymentId: 7103,
    amount: SUBSCRIPTION_PRICE.proMonthly,
    approvedAt: daysAgo(1),
    periodStart: second.periodEnd,
  });
  Object.assign(pro, { periodStart: third.periodStart, periodEnd: third.periodEnd });
  const team = TEAMS.find((item) => item.myRole === 'OWNER' && item.status === 'ACTIVE')!;
  const flex: Row = {
    subscriptionId: 7002,
    planKey: 'FLEX',
    billing: 'MONTHLY',
    teamId: team.id,
    periodStart: daysAgo(2),
    periodEnd: periodEnd(daysAgo(2), 'MONTHLY'),
    cancelAtPeriodEnd: false,
    seats: teamSeats(team.id),
    ended: false,
  };
  const flexPaid = payment(flex, {
    paymentId: 7104,
    amount: flexAmount(teamSeats(team.id)),
    approvedAt: daysAgo(2),
    periodStart: flex.periodStart,
  });
  return { subscriptions: [pro, flex], payments: [flexPaid, third, second, first] };
}

const accounts = new Map<number, RecordState>();
const storageKey = (viewer: MockViewer) => `linker:mock:subscriptions:v2:${viewer.me!.id}`;

export function state(viewer: MockViewer): RecordState {
  const userId = viewer.me!.id;
  let data = accounts.get(userId);
  if (!data && typeof window !== 'undefined') {
    try {
      data = JSON.parse(sessionStorage.getItem(storageKey(viewer)) ?? 'null') as
        RecordState | undefined;
    } catch {
      /* optional persistence */
    }
  }
  data ??= seed(viewer);
  accounts.set(userId, data);
  return data;
}

export function save(viewer: MockViewer, data: RecordState) {
  accounts.set(viewer.me!.id, data);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(storageKey(viewer), JSON.stringify(data));
    } catch {
      /* optional persistence */
    }
  }
}

/** Own running Pro/Scout row (Flex is per team). */
export function personalPlan(viewer: MockViewer): Plan | null {
  return (
    state(viewer).subscriptions.find((row) => row.teamId === null && live(row))?.planKey ?? null
  );
}

export function subscriptionView(row: Row): Subscription {
  const team = row.teamId === null ? null : TEAMS.find((item) => item.id === row.teamId);
  const nextSeats = row.teamId === null ? null : teamSeats(row.teamId);
  return {
    subscriptionId: row.subscriptionId,
    planKey: row.planKey,
    status: 'ACTIVE',
    billing: row.billing,
    teamId: row.teamId,
    teamName: team?.name ?? null,
    expiresOn: kstDate(row.periodEnd),
    nextBillingOn: null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    seats: row.seats,
    nextSeats,
    nextAmount: nextSeats === null ? null : flexAmount(nextSeats),
  };
}

export function liveSubscriptions(viewer: MockViewer): Subscription[] {
  return state(viewer).subscriptions.filter(live).map(subscriptionView);
}

function refusal(data: RecordState, item: PaymentRow): string | null {
  if (Date.parse(item.approvedAt) + SUBSCRIPTION_RULES.refundWithinDays * DAY <= Date.now())
    return REFUND_COPY.periodOver;
  const row = data.subscriptions.find((sub) => sub.subscriptionId === item.subscriptionId);
  if (!row || !live(row)) return REFUND_COPY.started;
  const latest = data.payments
    .filter((other) => other.subscriptionId === row.subscriptionId && other.status === 'DONE')
    .sort((a, b) => Date.parse(b.approvedAt) - Date.parse(a.approvedAt))[0];
  if (latest?.paymentId !== item.paymentId) return REFUND_COPY.notLatest;
  return Date.parse(row.periodStart) > Date.now() ? null : REFUND_COPY.started;
}

export function paymentView(data: RecordState, item: PaymentRow): Payment {
  const why = item.status === 'DONE' ? refusal(data, item) : null;
  return {
    paymentId: item.paymentId,
    orderName: item.orderName,
    planKey: item.planKey,
    billing: item.billing,
    teamId: item.teamId,
    amount: item.amount,
    status: item.status,
    method: item.method,
    approvedAt: item.approvedAt,
    canceledAt: item.canceledAt,
    refundedAmount: item.refundedAmount,
    refundable: item.status === 'DONE' && why === null,
    refundReason: why,
  };
}

/** Confirm side effect: idempotent per order, extends a running row from its current end. */
export function applyPayment(viewer: MockViewer, order: Order): PaymentRow {
  const data = state(viewer);
  const done = data.payments.find((item) => item.orderId === order.orderId);
  if (done) return done;
  let row = data.subscriptions.find(
    (sub) =>
      live(sub) &&
      sub.planKey === order.planKey &&
      (order.teamId === null ? sub.teamId === null : sub.teamId === order.teamId),
  );
  const now = new Date().toISOString();
  if (!row) {
    row = {
      subscriptionId: newId(),
      planKey: order.planKey,
      billing: order.billing,
      teamId: order.teamId,
      periodStart: now,
      periodEnd: now,
      cancelAtPeriodEnd: false,
      seats: null,
      ended: false,
    };
    data.subscriptions.push(row);
  }
  const start = row.periodEnd;
  row.billing = order.billing;
  row.periodStart = start;
  row.periodEnd = periodEnd(start, order.billing);
  row.seats = order.teamId === null ? null : teamSeats(order.teamId);
  const paid: PaymentRow = {
    ...payment(row, {
      paymentId: newId(),
      amount: order.amount,
      approvedAt: now,
      periodStart: start,
    }),
    orderId: order.orderId,
  };
  data.payments.unshift(paid);
  if (order.teamId !== null) {
    const team = TEAMS.find((item) => item.id === order.teamId);
    if (team) team.plan = 'FLEX';
  }
  save(viewer, data);
  return paid;
}

export function cancel(viewer: MockViewer, subscriptionId: number): Subscription {
  const data = state(viewer);
  const row = data.subscriptions.find((sub) => sub.subscriptionId === subscriptionId);
  if (!row) fail(404, 'SUBSCRIPTION_NOT_FOUND', '구독을 찾지 못했어요.');
  if (!live(row)) fail(409, 'SUBSCRIPTION_ENDED', '이미 끝난 구독이에요.');
  row.cancelAtPeriodEnd = true;
  save(viewer, data);
  return subscriptionView(row);
}

/** Refund takes back only this payment's period; the previous paid period keeps running. */
export function refund(viewer: MockViewer, paymentId: number): Payment {
  const data = state(viewer);
  const item = data.payments.find((other) => other.paymentId === paymentId);
  if (!item) fail(404, 'PAYMENT_NOT_FOUND', '결제 내역을 찾지 못했어요.');
  if (item.status !== 'DONE') return paymentView(data, item);
  const why = refusal(data, item);
  if (why) {
    const code =
      why === REFUND_COPY.periodOver
        ? 'REFUND_PERIOD_OVER'
        : why === REFUND_COPY.notLatest
          ? 'REFUND_NOT_LATEST'
          : 'REFUND_BENEFITS_USED';
    fail(409, code, why);
  }
  const row = data.subscriptions.find((sub) => sub.subscriptionId === item.subscriptionId)!;
  const previous = data.payments
    .filter((other) => other.subscriptionId === row.subscriptionId && other.status === 'DONE')
    .filter((other) => other.paymentId !== item.paymentId)
    .sort((a, b) => Date.parse(b.approvedAt) - Date.parse(a.approvedAt))[0];
  if (previous) {
    row.periodStart = previous.periodStart;
    row.periodEnd = previous.periodEnd;
  } else {
    row.ended = true;
    row.periodEnd = new Date().toISOString();
    const team = TEAMS.find((other) => other.id === row.teamId);
    if (team) team.plan = 'FREE';
  }
  item.status = 'CANCELED';
  item.canceledAt = new Date().toISOString();
  item.refundedAmount = item.amount;
  save(viewer, data);
  return paymentView(data, item);
}

/** Test hook: move a row's end, as if days passed. */
export function endPersonalPlanOn(viewer: MockViewer, plan: Plan, daysFromToday: number) {
  const data = state(viewer);
  const row = data.subscriptions.find((sub) => sub.teamId === null && sub.planKey === plan);
  if (row) row.periodEnd = daysFromNow(daysFromToday);
  save(viewer, data);
}
