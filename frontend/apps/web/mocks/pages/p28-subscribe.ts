import { SUBSCRIPTION_PRICE } from '@/lib/policy';
import { ownOrder, saveOrder, type Order } from '../fixtures/payment-orders';
import {
  applyPayment,
  flexAmount,
  kstDate,
  personalPlan,
  teamSeats,
} from '../fixtures/subscriptions';
import { fail, get, newId, post, type MockRoute } from '../core/define';
import { TEAMS } from '../fixtures/teams';

/**
 * 28 Plans & checkout: `SubscriptionController`. Toss test mode only; the mock confirms every order.
 * Recruiters get no plans until Scout ([Included]) opens, as on the server.
 */

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
    trialAvailable: false,
  },
  {
    key: 'FLEX',
    name: 'Flex',
    monthly: SUBSCRIPTION_PRICE.flexMonthly,
    yearly: null,
    benefits: ['팀원 수 제한 없음', '채팅 전체 기간 검색', 'AI 채팅 요약', '진행 현황 그래프'],
    trialAvailable: false,
    perExtraMember: SUBSCRIPTION_PRICE.flexExtraMember,
  },
];

function candidates() {
  return TEAMS.filter((team) => team.myRole === 'OWNER' && team.status === 'ACTIVE').map(
    (team) => ({
      teamId: team.id,
      name: team.name,
      memberCount: teamSeats(team.id),
      amount: flexAmount(teamSeats(team.id)),
      currentPlan: team.plan,
    }),
  );
}

export const routes: MockRoute[] = [
  get('/api/v1/user/plans', ({ query, viewer }) => ({
    reason: query.get('reason'),
    plans: viewer.role === 'recruiter' ? [] : developerPlans,
    currentPlan: personalPlan(viewer) ?? 'FREE',
  })),
  get('/api/v1/user/plans/team-candidates', () => ({ items: candidates() }), { only: 'developer' }),
  post('/api/v1/user/payments/checkout', ({ body, viewer }) => {
    const planKey = String(body.planKey);
    // Same order as the server: plan key, member type, then billing.
    if (!['PRO', 'FLEX', 'SCOUT'].includes(planKey))
      fail(400, 'VALIDATION_ERROR', '요금제를 선택해 주세요.');
    if (viewer.role === 'recruiter' || planKey === 'SCOUT')
      fail(403, 'PLAN_MISMATCH', '선택할 수 없는 요금제예요.');
    if (body.billing !== 'MONTHLY' && body.billing !== 'YEARLY')
      fail(400, 'INVALID_BILLING', '결제 기간을 확인해 주세요.');
    if (body.billing === 'YEARLY' && planKey !== 'PRO')
      fail(400, 'INVALID_BILLING', '이 요금제는 월간 결제만 가능해요.');
    const candidate =
      planKey === 'FLEX' ? candidates().find((team) => team.teamId === Number(body.teamId)) : null;
    if (planKey === 'FLEX' && !candidate)
      fail(403, 'TEAM_PERMISSION', '결제할 팀을 다시 선택해 주세요.');
    const amount = candidate
      ? candidate.amount
      : body.billing === 'YEARLY'
        ? SUBSCRIPTION_PRICE.proYearly
        : SUBSCRIPTION_PRICE.proMonthly;
    const order: Order = {
      orderId: `lnk_mock_${newId()}`,
      userId: viewer.me!.id,
      amount,
      planKey: planKey as Order['planKey'],
      billing: body.billing,
      teamId: candidate?.teamId ?? null,
      orderName: candidate
        ? `Flex · ${candidate.name} 구독`
        : body.billing === 'YEARLY'
          ? 'Pro 연간 구독'
          : 'Pro 월간 구독',
      state: 'PENDING',
    };
    saveOrder(order);
    return {
      orderId: order.orderId,
      amount: order.amount,
      orderName: order.orderName,
      customerKey: `mock_customer_${viewer.me!.id}`,
      planKey: order.planKey,
      billing: order.billing,
      teamId: order.teamId,
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
    saveOrder(order);
    // Replays return the stored result; no second period.
    const paid = applyPayment(viewer, order);
    return {
      planKey: order.planKey,
      status: 'ACTIVE',
      expiresOn: kstDate(paid.periodEnd),
      amount: order.amount,
      benefits: developerPlans.find((item) => item.key === order.planKey)!.benefits,
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
