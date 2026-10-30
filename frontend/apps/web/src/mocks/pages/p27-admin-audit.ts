import { daysAgo, get, hoursAgo, newId, type MockRoute } from '../core/define';

/** 27 Ops: action log: `AdminAuditController` (who, when, what, why; PRD O-5) */

type AuditLog = {
  id: number;
  admin: string;
  actionType: string;
  target: string;
  reason: string;
  createdAt: string;
};

const logs: AuditLog[] = [
  {
    id: 1,
    admin: '운영자 A',
    actionType: 'REPORT_HIDE',
    target: 'COMMENT #5',
    reason: '비방 표현이 포함돼 있어요',
    createdAt: daysAgo(8),
  },
  {
    id: 2,
    admin: '운영자 B',
    actionType: 'SANCTION_WARNING',
    target: 'USER taeyang-yoon',
    reason: '홍보성 게시물 반복',
    createdAt: daysAgo(7),
  },
  {
    id: 3,
    admin: '운영자 A',
    actionType: 'REPORT_DELETE',
    target: 'POST #12',
    reason: '스팸 홍보',
    createdAt: daysAgo(3),
  },
  {
    id: 4,
    admin: '리드 운영자',
    actionType: 'SANCTION_LIFT',
    target: 'USER serin-oh',
    reason: '이의 제기 수용',
    createdAt: daysAgo(2),
  },
  {
    id: 5,
    admin: '운영자 B',
    actionType: 'EMAIL_REVEAL',
    target: 'USER doyun-lee',
    reason: '결제 문의 확인',
    createdAt: hoursAgo(10),
  },
];

export const ADMINS = ['운영자 A', '운영자 B', '리드 운영자'];

/** Other admin mocks add rows here so the log screen reflects what was just done */
export function addAuditLog(entry: Omit<AuditLog, 'id' | 'createdAt'>) {
  logs.unshift({ id: newId(), createdAt: new Date().toISOString(), ...entry });
}

export const routes: MockRoute[] = [
  get('/api/v1/admin/audit-logs', ({ query }) => {
    const admin = query.get('adminId');
    const actionType = query.get('actionType');
    const from = query.get('from');
    const to = query.get('to');
    return {
      items: logs
        .filter((l) => !admin || l.admin === admin)
        .filter((l) => !actionType || l.actionType === actionType)
        .filter((l) => !from || l.createdAt.slice(0, 10) >= from)
        .filter((l) => !to || l.createdAt.slice(0, 10) <= to),
    };
  }),
  get('/api/v1/admin/audit-logs/filters', () => ({
    admins: ADMINS.map((name) => ({ id: name, name })),
    actionTypes: [...new Set(logs.map((l) => l.actionType))],
  })),
];
