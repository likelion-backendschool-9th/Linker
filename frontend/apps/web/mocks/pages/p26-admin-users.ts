import { daysAgo, del, fail, get, newId, post, type MockRoute } from '../core/define';
import { ALL_USERS, brief, findUserById } from '../fixtures/users';
import { addAuditLog } from './p27-admin-audit';

/** 26 Ops: users: `AdminController`. Email is masked unless a reason is entered (POL ch. 10). */

type Sanction = {
  id: number;
  step: string;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  reasonCode: string;
  revokedAt: string | null;
  active: boolean;
};

const sanctions: Record<number, Sanction[]> = {
  7: [
    {
      id: 1,
      step: 'WARNING',
      reason: '홍보성 게시물 반복',
      startsAt: daysAgo(7),
      endsAt: null,
      reasonCode: 'OTHER',
      revokedAt: null,
      active: true,
    },
  ],
};
// Page-owned examples use the same response shape and unsupported review flag as Spring.
const suspended = new Set<number>([7]);
const withdrawing = new Set<number>([8]);
const userStatus = (id: number) =>
  suspended.has(id) ? 'SUSPENDED' : withdrawing.has(id) ? 'WITHDRAWING' : 'ACTIVE';

const mask = (email: string) => `${email.slice(0, 3)}***@${email.split('@')[1]}`;

export const routes: MockRoute[] = [
  get('/api/v1/admin/users', ({ query }) => {
    const q = (query.get('q') ?? '').replace(/^@/, '').toLowerCase();
    const status = query.get('status');
    const userType = query.get('userType');
    const review = query.get('needsReview');
    if (review === 'true')
      fail(503, 'SERVICE_UNAVAILABLE', '확인 필요 판정과 해제 기준은 팀 합의 후 제공해요');
    const items = ALL_USERS.filter((u) => !q || u.login.includes(q) || u.name.includes(q))
      .filter((u) => !userType || u.userType === userType)
      .filter((u) => !status || userStatus(u.id) === status)
      .map((u) => ({
        ...brief(u),
        emailMasked: mask(u.email),
        status: userStatus(u.id),
        // 3× a daily limit (POL ch. 2 rate limits)
        needsReview: null,
        joinedAt: u.joinedAt,
      }));
    const start = query.get('cursor')
      ? items.findIndex((item) => String(item.id) === query.get('cursor')) + 1
      : 0;
    const size = Math.max(1, Math.min(100, Number(query.get('size') ?? 20)));
    const page = items.slice(start, start + size);
    return {
      items: page,
      reviewFilterSupported: false,
      nextCursor: start + size < items.length ? String(page.at(-1)!.id) : null,
    };
  }),
  get('/api/v1/admin/users/:userId', ({ params }) => {
    const user = findUserById(Number(params.userId));
    if (!user) fail(404, 'NOT_FOUND', '회원을 찾지 못했어요');
    return {
      ...brief(user),
      emailMasked: mask(user.email),
      status: userStatus(user.id),
      allowedActions: { permanentSanction: false, liftSanction: false, refund: true },
      joinedAt: user.joinedAt,
      sanctions: sanctions[user.id] ?? [],
      reportHistory: [{ caseId: 1, targetType: 'POST', result: 'HIDE', at: daysAgo(9) }],
      subscriptions: [
        user.userType === 'RECRUITER'
          ? { id: 2, plan: 'SCOUT', status: 'ACTIVE', teamId: null, periodEnd: daysAgo(-30) }
          : { id: 1, plan: 'PRO', status: 'ACTIVE', teamId: null, periodEnd: daysAgo(-30) },
      ],
      payments: [{ id: 1, amount: 2900, status: 'DONE', paidAt: daysAgo(3), refundedAmount: 0 }],
      // Recruiters: company info and 30-day offer stats
      recruiter:
        user.userType === 'RECRUITER'
          ? {
              company: user.company,
              domain: user.companyEmailDomain,
              jobTitle: user.jobTitle,
              offersSent30d: 14,
              offersAccepted30d: 3,
            }
          : null,
    };
  }),
  // Warning → 7 days → 30 days → permanent (lead only), reason required
  post('/api/v1/admin/users/:userId/sanctions', ({ params, body, viewer }) => {
    const userId = Number(params.userId);
    const step = String(body.step ?? 'WARNING');
    if (!String(body.reason ?? '').trim()) fail(400, 'REASON_REQUIRED', '사유를 입력해 주세요');
    if (step === 'PERMANENT' && viewer.me!.name !== '리드 운영자') {
      fail(403, 'LEAD_REQUIRED', '영구 정지는 리드 운영자만 할 수 있어요');
    }
    const sanction: Sanction = {
      id: newId(),
      step,
      reason: String(body.reason).trim(),
      reasonCode: String(body.reasonCode ?? 'OTHER'),
      revokedAt: null,
      active: true,
      startsAt: new Date().toISOString(),
      endsAt:
        step === 'WARNING' || step === 'PERMANENT' ? null : daysAgo(step === 'DAYS_7' ? -7 : -30),
    };
    (sanctions[userId] ??= []).push(sanction);
    if (step !== 'WARNING') suspended.add(userId);
    addAuditLog({
      admin: viewer.me!.name,
      actionType: `SANCTION_${step}`,
      target: `USER ${userId}`,
      reason: sanction.reason,
    });
    return sanction;
  }),
  del('/api/v1/admin/users/:userId/sanctions/:sanctionId', ({ params, viewer }) => {
    if (viewer.me!.name !== '리드 운영자') fail(403, 'LEAD_REQUIRED', '리드 운영자만 할 수 있어요');
    const userId = Number(params.userId);
    const sanction = (sanctions[userId] ?? []).find((s) => s.id === Number(params.sanctionId));
    if (!sanction) fail(404, 'NOT_FOUND', '제재를 찾지 못했어요');
    sanction.active = false;
    sanction.revokedAt = new Date().toISOString();
    suspended.delete(userId);
    addAuditLog({
      admin: viewer.me!.name,
      actionType: 'SANCTION_LIFT',
      target: `USER ${userId}`,
      reason: '운영자 해제',
    });
    return undefined;
  }),
  post('/api/v1/admin/users/:userId/email-reveal', ({ params, body, viewer }) => {
    const user = findUserById(Number(params.userId));
    if (!user) fail(404, 'NOT_FOUND', '회원을 찾지 못했어요');
    if (!String(body.reason ?? '').trim())
      fail(400, 'REASON_REQUIRED', '열람 사유를 입력해 주세요');
    addAuditLog({
      admin: viewer.me!.name,
      actionType: 'EMAIL_REVEAL',
      target: `USER ${user.login}`,
      reason: String(body.reason).trim(),
    });
    return { email: user.email };
  }),
  // `[Included]` Toss payment cancel
  post('/api/v1/admin/payments/:paymentId/refund', () => ({ refunded: true })),
];
