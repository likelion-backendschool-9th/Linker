import { daysAgo, fail, get, hoursAgo, post, type MockRoute } from '../core/define';
import { brief, DEVELOPERS } from '../fixtures/users';
import { addAuditLog } from './p27-admin-audit';

/** 25 Ops: reports: `AdminReportController` (handle within 2 business days, POL ch. 9) */

const [, doyun, seoyeon, minjae, hayun, , taeyang] = DEVELOPERS;

type ReportCase = {
  id: number;
  status: 'PENDING' | 'HANDLED' | 'APPEALED';
  targetType: string;
  targetSummary: string;
  reasons: { reason: string; count: number }[];
  reporterCount: number;
  autoHidden: boolean;
  receivedAt: string;
  /** Past 2 business days */
  overdue: boolean;
  target: ReturnType<typeof brief>;
  /** Chat reports keep only the message and 10 before/after (POL ch. 9) */
  chatContext: { sender: string; text: string; reported?: boolean }[] | null;
  handledAction: string | null;
};

const cases: ReportCase[] = [
  {
    id: 1,
    status: 'PENDING',
    targetType: 'POST',
    targetSummary: '"무료 수강권 증정! 링크 클릭" 이라는 홍보 게시물',
    reasons: [{ reason: 'SPAM', count: 5 }],
    reporterCount: 5,
    autoHidden: true,
    receivedAt: hoursAgo(30),
    overdue: false,
    target: brief(taeyang!),
    chatContext: null,
    handledAction: null,
  },
  {
    id: 2,
    status: 'PENDING',
    targetType: 'TEAM_MESSAGE',
    targetSummary: '팀 채팅 메시지 신고',
    reasons: [{ reason: 'ABUSE', count: 1 }],
    reporterCount: 1,
    autoHidden: false,
    receivedAt: daysAgo(4),
    overdue: true,
    target: brief(hayun!),
    chatContext: [
      { sender: '이도윤', text: '이 부분 다시 확인해 주세요' },
      { sender: '정하윤', text: '(신고된 메시지) 욕설이 담긴 내용이에요', reported: true },
      { sender: '박서연', text: '진정하고 이야기해요' },
    ],
    handledAction: null,
  },
  {
    id: 3,
    status: 'PENDING',
    targetType: 'RECRUIT_POST',
    targetSummary: '"수강료 선입금" 모집 글',
    reasons: [
      { reason: 'FAKE_RECRUIT', count: 2 },
      { reason: 'SPAM', count: 1 },
    ],
    reporterCount: 3,
    autoHidden: false,
    receivedAt: daysAgo(1),
    overdue: false,
    target: brief(minjae!),
    chatContext: null,
    handledAction: null,
  },
  {
    id: 4,
    status: 'PENDING',
    targetType: 'RECRUITER_AD',
    targetSummary: '존재하지 않는 회사의 채용 광고',
    reasons: [{ reason: 'FAKE_RECRUIT', count: 1 }],
    reporterCount: 1,
    autoHidden: false,
    receivedAt: hoursAgo(6),
    overdue: false,
    target: brief(seoyeon!),
    chatContext: null,
    handledAction: null,
  },
  {
    id: 5,
    status: 'HANDLED',
    targetType: 'COMMENT',
    targetSummary: '비방 댓글',
    reasons: [{ reason: 'ABUSE', count: 2 }],
    reporterCount: 2,
    autoHidden: false,
    receivedAt: daysAgo(8),
    overdue: false,
    target: brief(doyun!),
    chatContext: null,
    handledAction: 'HIDE',
  },
  {
    id: 6,
    status: 'APPEALED',
    targetType: 'POST',
    targetSummary: '표절 의혹 게시물',
    reasons: [{ reason: 'PLAGIARISM', count: 1 }],
    reporterCount: 1,
    autoHidden: false,
    receivedAt: daysAgo(10),
    overdue: false,
    target: brief(taeyang!),
    chatContext: null,
    handledAction: 'DELETE',
  },
];

const appeals = [
  {
    id: 1,
    status: 'PENDING',
    user: brief(taeyang!),
    caseId: 6,
    reason: '직접 작성한 코드입니다. 근거 자료를 첨부합니다.',
    createdAt: daysAgo(2),
    originalHandler: '운영자 A',
  },
  {
    id: 2,
    status: 'DECIDED',
    user: brief(doyun!),
    caseId: 5,
    reason: '맥락을 고려해 주세요.',
    createdAt: daysAgo(6),
    originalHandler: '운영자 B',
  },
];

export const routes: MockRoute[] = [
  get('/api/v1/admin/report-cases', ({ query }) => {
    const status = query.get('status');
    const targetType = query.get('targetType');
    const overdue = query.get('overdue');
    return {
      items: cases
        .filter((c) => !status || c.status === status)
        .filter((c) => !targetType || c.targetType === targetType)
        .filter((c) => overdue !== 'true' || c.overdue)
        .map((row) => ({ ...row, chatContext: undefined })),
    };
  }),
  get('/api/v1/admin/report-cases/:caseId', ({ params }) => {
    const found = cases.find((c) => c.id === Number(params.caseId));
    if (!found) fail(404, 'NOT_FOUND', '신고 건을 찾지 못했어요');
    return found;
  }),
  post('/api/v1/admin/report-cases/:caseId/actions', ({ params, body, viewer }) => {
    const found = cases.find((c) => c.id === Number(params.caseId));
    if (!found) fail(404, 'NOT_FOUND', '신고 건을 찾지 못했어요');
    const action = String(body.action ?? 'DISMISS');
    // Hide / delete need a reason (POL ch. 10)
    if ((action === 'HIDE' || action === 'DELETE') && !String(body.reason ?? '').trim()) {
      fail(400, 'REASON_REQUIRED', '사유를 입력해 주세요');
    }
    found.status = 'HANDLED';
    found.handledAction = action;
    addAuditLog({
      admin: viewer.me!.name,
      actionType: `REPORT_${action}`,
      target: `${found.targetType} #${found.id}`,
      reason: String(body.reason ?? ''),
    });
    return found;
  }),
  get('/api/v1/admin/appeals', ({ query }) => {
    const status = query.get('status');
    return { items: appeals.filter((a) => !status || a.status === status) };
  }),
  // Only an operator other than the original handler may decide (POL ch. 9 "Appeals")
  post('/api/v1/admin/appeals/:appealId/decision', ({ params, body, viewer }) => {
    const appeal = appeals.find((a) => a.id === Number(params.appealId));
    if (!appeal) fail(404, 'NOT_FOUND', '이의 제기를 찾지 못했어요');
    if (appeal.originalHandler === viewer.me!.name) {
      fail(403, 'SAME_HANDLER', '처음 처리한 운영자는 결정할 수 없어요');
    }
    appeal.status = 'DECIDED';
    addAuditLog({
      admin: viewer.me!.name,
      actionType: body.accept ? 'APPEAL_ACCEPT' : 'APPEAL_REJECT',
      target: `APPEAL #${appeal.id}`,
      reason: String(body.reason ?? ''),
    });
    return undefined;
  }),
  // `[Included]` OTP 2FA: any 6 digits except 000000 pass
  post('/api/v1/admin/otp/verify', ({ body }) => {
    const code = String(body.code ?? '');
    if (!/^\d{6}$/.test(code) || code === '000000') {
      fail(400, 'OTP_INVALID', '인증 코드가 맞지 않아요');
    }
    return { verified: true };
  }),
];
