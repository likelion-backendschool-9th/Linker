import { addMonths, addYears } from 'date-fns';
import { PLAN_LIMITS, SUBSCRIPTION_PRICE } from '@/lib/policy';
import type { MockViewer } from '../core/viewer';
import { fail, get, newId, post, type MockRoute } from '../core/define';
import { TEAM_MEMBERS, TEAMS } from '../fixtures/teams';

/** 28 Plans & checkout: `SubscribeController`. Toss test mode only; the mock confirms every order. */

const developerPlans = [
  {
    key: 'FREE',
    name: '무료',
    monthly: 0,
    yearly: 0,
    benefits: ['팔로우·좋아요·댓글', '작업물 올리기', '팀·이슈·캘린더·상태 보드'],
    trialAvailable: false,
  },
  {
    key: 'PRO',
    name: 'Pro',
    monthly: SUBSCRIPTION_PRICE.proMonthly,
    yearly: SUBSCRIPTION_PRICE.proYearly,
    benefits: [
      '채용 담당자 프로필 열람 알림',
      '게시물 유입 경로 통계',
      '사진 10장',
      '대표 게시물 5개',
      '모집 글 동시 10개',
    ],
    trialAvailable: true,
  },
  {
    key: 'FLEX',
    name: 'Flex',
    monthly: SUBSCRIPTION_PRICE.flexMonthly,
    yearly: null,
    benefits: ['팀원 수 제한 없음', '채팅 전체 기간 검색', 'AI 채팅 요약', '진행 현황 그래프'],
    trialAvailable: true,
    perExtraMember: SUBSCRIPTION_PRICE.flexExtraMember,
  },
];

const recruiterPlans = [
  {
    key: 'SCOUT',
    name: 'Scout',
    monthly: SUBSCRIPTION_PRICE.scoutMonthly,
    yearly: null,
    benefits: ['채용 제안 하루 50건', '피드 채용 광고 1개'],
    trialAvailable: false,
  },
];

// Mock orders survive provider callbacks/reloads within this browser tab. No real payment data is stored.
type Order = {
  orderId: string;
  userId: number;
  amount: number;
  planKey: 'PRO' | 'FLEX' | 'SCOUT';
  billing: 'MONTHLY' | 'YEARLY';
  teamId: number | null;
  state: 'PENDING' | 'PAID' | 'FAILED';
  expiresOn: string;
};
const orders = new Map<string, Order>();
function readOrders(viewer: MockViewer): Order[] {
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
function saveOrder(order: Order) {
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
function ownOrder(viewer: MockViewer, id: string): Order {
  const order = readOrders(viewer).find((item) => item.orderId === id);
  if (!order) fail(404, 'ORDER_NOT_FOUND', '주문을 찾지 못했어요.');
  return order;
}
const flexAmount = (members: number) =>
  SUBSCRIPTION_PRICE.flexMonthly +
  Math.max(0, members - PLAN_LIMITS.teamMembers.free) * SUBSCRIPTION_PRICE.flexExtraMember;
function candidates() {
  return TEAMS.filter((team) => team.myRole === 'OWNER' && team.status === 'ACTIVE').map(
    (team) => ({
      teamId: team.id,
      name: team.name,
      memberCount: TEAM_MEMBERS[team.id]?.length ?? 0,
      amount: flexAmount(TEAM_MEMBERS[team.id]?.length ?? 0),
      currentPlan: team.plan,
    }),
  );
}

export const routes: MockRoute[] = [
  get('/api/v1/user/plans', ({ query, viewer }) => {
    const personal = readOrders(viewer)
      .filter((order) => order.state === 'PAID' && order.planKey !== 'FLEX')
      .at(-1);
    return {
      reason: query.get('reason'),
      plans: viewer.role === 'recruiter' ? recruiterPlans : developerPlans,
      currentPlan: personal?.planKey ?? (viewer.role === 'recruiter' ? 'FREE' : 'PRO'),
    };
  }),
  get('/api/v1/user/plans/team-candidates', () => ({ items: candidates() }), { only: 'developer' }),
  post('/api/v1/user/payments/checkout', ({ body, viewer }) => {
    const planKey = String(body.planKey);
    if (viewer.role === 'recruiter' ? planKey !== 'SCOUT' : !['PRO', 'FLEX'].includes(planKey))
      fail(403, 'PLAN_MISMATCH', '선택할 수 없는 요금제예요.');
    if (body.billing !== 'MONTHLY' && body.billing !== 'YEARLY')
      fail(400, 'INVALID_BILLING', '결제 기간을 확인해 주세요.');
    const plan = [...developerPlans, ...recruiterPlans].find((item) => item.key === planKey)!;
    if (body.billing === 'YEARLY' && planKey !== 'PRO')
      fail(400, 'INVALID_BILLING', '이 요금제는 월간 결제만 가능해요.');
    const candidate =
      planKey === 'FLEX' ? candidates().find((team) => team.teamId === Number(body.teamId)) : null;
    if (planKey === 'FLEX' && !candidate)
      fail(403, 'TEAM_PERMISSION', '결제할 팀을 다시 선택해 주세요.');
    const amount = candidate
      ? candidate.amount
      : body.billing === 'YEARLY'
        ? plan.yearly!
        : plan.monthly;
    const orderId = `order-${newId()}`;
    const expires = body.billing === 'YEARLY' ? addYears(new Date(), 1) : addMonths(new Date(), 1);
    const order: Order = {
      orderId,
      userId: viewer.me!.id,
      amount,
      planKey: planKey as Order['planKey'],
      billing: body.billing,
      teamId: candidate?.teamId ?? null,
      state: 'PENDING',
      expiresOn: expires.toISOString().slice(0, 10),
    };
    saveOrder(order);
    return {
      ...order,
      orderName: `${plan.name}${candidate ? ` · ${candidate.name}` : ''} 구독`,
      customerKey: `mock_customer_${viewer.me!.id}`,
    };
  }),
  post('/api/v1/user/payments/confirm', ({ body, viewer }) => {
    const order = ownOrder(viewer, String(body.orderId));
    if (order.state === 'FAILED')
      fail(409, 'ORDER_FAILED', '완료되지 않은 주문이에요. 새로 결제해 주세요.');
    if (body.amount !== order.amount) fail(400, 'AMOUNT_MISMATCH', '결제 금액이 달라요.');
    if (body.paymentKey !== `mock_${order.orderId}`)
      fail(400, 'INVALID_PAYMENT', '결제 정보를 확인할 수 없어요.');
    order.state = 'PAID';
    saveOrder(order); // Idempotent confirmation; no second entitlement activation.
    const plan = [...developerPlans, ...recruiterPlans].find((item) => item.key === order.planKey)!;
    if (order.planKey === 'FLEX') {
      const team = TEAMS.find((item) => item.id === order.teamId);
      if (team) team.plan = 'FLEX';
    }
    return {
      planKey: order.planKey,
      status: 'ACTIVE',
      expiresOn: order.expiresOn,
      amount: order.amount,
      benefits: plan.benefits,
    };
  }),
  post('/api/v1/user/payments/:orderId/fail', ({ params, viewer }) => {
    const order = ownOrder(viewer, params.orderId);
    if (order.state === 'PAID') fail(409, 'PAYMENT_CONFIRMED', '이미 승인된 결제예요.');
    order.state = 'FAILED';
    saveOrder(order);
    return undefined;
  }),
];
