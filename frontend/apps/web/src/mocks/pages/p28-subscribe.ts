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
    monthly: 2900,
    yearly: 29000,
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
    monthly: 7900,
    yearly: null,
    benefits: ['팀원 수 제한 없음', '채팅 전체 기간 검색', 'AI 채팅 요약', '진행 현황 그래프'],
    trialAvailable: true,
    perExtraMember: 1900,
  },
];

const recruiterPlans = [
  {
    key: 'SCOUT',
    name: 'Scout',
    monthly: 14900,
    yearly: null,
    benefits: ['채용 제안 하루 50건', '피드 채용 광고 1개'],
    trialAvailable: false,
  },
];

// Flex price: ₩7,900 up to 6 members, +₩1,900 per member from the 7th (POL ch. 11)
const flexAmount = (members: number) => 7900 + Math.max(0, members - 6) * 1900;

const orders = new Map<string, { amount: number; planKey: string }>();

export const routes: MockRoute[] = [
  get('/api/v1/user/plans', ({ query, viewer }) => ({
    reason: query.get('reason'),
    plans: viewer.role === 'recruiter' ? recruiterPlans : developerPlans,
    currentPlan: viewer.role === 'recruiter' ? 'FREE' : 'PRO',
  })),
  get('/api/v1/user/plans/team-candidates', () => ({
    items: TEAMS.filter((t) => t.myRole === 'OWNER' && t.plan === 'FREE')
      .concat(TEAMS.filter((t) => t.id === 1))
      .map((t) => {
        const members = TEAM_MEMBERS[t.id]?.length ?? 0;
        return {
          teamId: t.id,
          name: t.name,
          memberCount: members,
          amount: flexAmount(members),
          currentPlan: t.plan,
        };
      }),
  })),
  post('/api/v1/user/payments/checkout', ({ body, viewer }) => {
    const planKey = String(body.planKey ?? 'PRO');
    // Plan must match the member type (POL ch. 11)
    if (viewer.role === 'recruiter' && planKey !== 'SCOUT')
      fail(403, 'PLAN_MISMATCH', '채용 담당자는 Scout만 구독할 수 있어요');
    if (viewer.role !== 'recruiter' && planKey === 'SCOUT')
      fail(403, 'PLAN_MISMATCH', '개발자는 Scout를 구독할 수 없어요');
    const plan = [...developerPlans, ...recruiterPlans].find((p) => p.key === planKey);
    const amount = body.billing === 'YEARLY' && plan?.yearly ? plan.yearly : (plan?.monthly ?? 0);
    const orderId = `order-${newId()}`;
    orders.set(orderId, { amount, planKey });
    return {
      orderId,
      amount,
      orderName: `${plan?.name ?? ''} 구독`,
      customerKey: `customer-${viewer.me!.id}`,
    };
  }),
  // Benefits unlock only after the server confirms with Toss (the mock always confirms)
  post('/api/v1/user/payments/confirm', ({ body }) => {
    const order = orders.get(String(body.orderId));
    if (!order) fail(404, 'ORDER_NOT_FOUND', '주문을 찾지 못했어요');
    if (order.amount !== Number(body.amount)) fail(400, 'AMOUNT_MISMATCH', '결제 금액이 달라요');
    return { planKey: order.planKey, status: 'ACTIVE', nextBillingDate: '2026-11-30' };
  }),
  post('/api/v1/user/payments/:orderId/fail', () => undefined),
];
