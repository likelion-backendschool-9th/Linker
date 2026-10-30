import { daysAgo, del, fail, get, newId, post, type MockRoute } from '../core/define';
import { ALL_USERS, brief, findUserById } from '../fixtures/users';
import { addAuditLog } from './p27-admin-audit';

/** 26 Ops: users: `AdminUserController`. Email is masked unless a reason is entered (POL ch. 10). */

type Sanction = {
  id: number;
  step: string;
  reason: string;
  startsAt: string;
  endsAt: string | null;
};

const sanctions: Record<number, Sanction[]> = {
  7: [{ id: 1, step: 'WARNING', reason: '홍보성 게시물 반복', startsAt: daysAgo(7), endsAt: null }],
};
const needsReview = new Set<number>([7, 8]);
const suspended = new Set<number>();

const mask = (email: string) => `${email.slice(0, 3)}***@${email.split('@')[1]}`;

export const routes: MockRoute[] = [
  get('/api/v1/admin/users', ({ query }) => {
    const q = (query.get('q') ?? '').toLowerCase();
    const status = query.get('status');
    const userType = query.get('userType');
    const review = query.get('needsReview');
    return {
      items: ALL_USERS.filter((u) => !q || u.login.includes(q) || u.name.includes(q))
        .filter((u) => !userType || u.userType === userType)
        .filter((u) => !status || (suspended.has(u.id) ? 'SUSPENDED' : 'ACTIVE') === status)
        .filter((u) => review !== 'true' || needsReview.has(u.id))
        .map((u) => ({
          ...brief(u),
          emailMasked: mask(u.email),
          status: suspended.has(u.id) ? 'SUSPENDED' : 'ACTIVE',
          // 3× a daily limit (POL ch. 2 rate limits)
          needsReview: needsReview.has(u.id),
          joinedAt: u.joinedAt,
        })),
    };
  }),
  get('/api/v1/admin/users/:userId', ({ params }) => {
    const user = findUserById(Number(params.userId));
    if (!user) fail(404, 'NOT_FOUND', '회원을 찾지 못했어요');
    return {
      ...brief(user),
      emailMasked: mask(user.email),
      status: suspended.has(user.id) ? 'SUSPENDED' : 'ACTIVE',
      joinedAt: user.joinedAt,
      sanctions: sanctions[user.id] ?? [],
      reportHistory: [{ caseId: 1, targetType: 'POST', result: 'HIDE', at: daysAgo(9) }],
      subscription:
        user.userType === 'RECRUITER'
          ? { plan: 'SCOUT', status: 'ACTIVE' }
          : { plan: 'PRO', status: 'ACTIVE' },
      payments: [{ id: 1, amount: 2900, status: 'PAID', paidAt: daysAgo(3) }],
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
      reason: String(body.reason),
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
    const userId = Number(params.userId);
    sanctions[userId] = (sanctions[userId] ?? []).filter((s) => s.id !== Number(params.sanctionId));
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
      reason: String(body.reason),
    });
    return { email: user.email };
  }),
  // `[Included]` Toss payment cancel
  post('/api/v1/admin/payments/:paymentId/refund', () => ({ refunded: true })),
];
