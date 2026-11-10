import { daysAgo, get, hoursAgo, newId, type MockRoute } from '../core/define';
import { todayKst } from '@/lib/format/time';

// Keep the existing addAuditLog input for A/B callers; normalize at this page's mock boundary.
type Entry = { admin: string; actionType: string; target: string; reason: string };
type AuditLog = Entry & {
  id: number;
  createdAt: string;
  adminId: number;
  targetType: string;
  targetId: number | null;
  sanctionStep: string | null;
};
export const ADMINS = ['운영자 A', '운영자 B', '리드 운영자'];
const adminIds = new Map(ADMINS.map((name, index) => [name, index + 1]));
function normalize(entry: Entry) {
  if (!adminIds.has(entry.admin)) adminIds.set(entry.admin, adminIds.size + 1);
  const [targetType = '', targetId = ''] = entry.target.replace('#', '').split(' ');
  const actionType =
    entry.actionType.startsWith('SANCTION_') && entry.actionType !== 'SANCTION_LIFT'
      ? 'SANCTION'
      : ((
          {
            REPORT_HIDE: 'HIDE',
            REPORT_DELETE: 'DELETE',
            SANCTION_LIFT: 'REVOKE',
            EMAIL_REVEAL: 'VIEW_EMAIL',
          } as Record<string, string>
        )[entry.actionType] ?? entry.actionType);
  return {
    ...entry,
    adminId: adminIds.get(entry.admin)!,
    actionType,
    targetType,
    targetId: /^\d+$/.test(targetId) ? Number(targetId) : null,
    sanctionStep: actionType === 'SANCTION' ? entry.actionType.replace(/^SANCTION_/, '') : null,
  };
}
const logs: AuditLog[] = [
  {
    id: 1,
    ...normalize({
      admin: '운영자 A',
      actionType: 'HIDE',
      target: 'COMMENT 5',
      reason: '비방 표현이 포함돼 있어요',
    }),
    createdAt: daysAgo(8),
  },
  {
    id: 2,
    ...normalize({
      admin: '운영자 B',
      actionType: 'SANCTION_WARNING',
      target: 'USER 7',
      reason: '홍보성 게시물 반복',
    }),
    createdAt: daysAgo(7),
  },
  {
    id: 3,
    ...normalize({
      admin: '운영자 A',
      actionType: 'DELETE',
      target: 'POST 12',
      reason: '스팸 홍보',
    }),
    createdAt: daysAgo(3),
  },
  {
    id: 4,
    ...normalize({
      admin: '리드 운영자',
      actionType: 'REVOKE',
      target: 'USER 8',
      reason: '이의 제기 수용',
    }),
    createdAt: daysAgo(2),
  },
  {
    id: 5,
    ...normalize({
      admin: '운영자 B',
      actionType: 'VIEW_EMAIL',
      target: 'USER 2',
      reason: '결제 문의 확인',
    }),
    createdAt: hoursAgo(10),
  },
];
export function addAuditLog(entry: Entry) {
  logs.unshift({ id: newId(), createdAt: new Date().toISOString(), ...normalize(entry) });
}
const ACTION_TYPES = [
  'HIDE',
  'DELETE',
  'RESTORE',
  'SANCTION',
  'REVOKE',
  'DISMISS',
  'VIEW_EMAIL',
  'APPEAL_ACCEPT',
  'APPEAL_REJECT',
  'REFUND',
];
export const routes: MockRoute[] = [
  get('/api/v1/admin/audit-logs', ({ query }) => {
    const admin = query.get('adminId'),
      action = query.get('actionType'),
      from = query.get('from'),
      to = query.get('to');
    const items = logs
      .filter((l) => !admin || String(l.adminId) === admin)
      .filter((l) => !action || l.actionType === action)
      .filter((l) => !from || todayKst(new Date(l.createdAt)) >= from)
      .filter((l) => !to || todayKst(new Date(l.createdAt)) <= to)
      .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
    const start = query.get('cursor')
      ? items.findIndex((item) => String(item.id) === query.get('cursor')) + 1
      : 0;
    const size = Math.max(1, Math.min(100, Number(query.get('size') ?? 20)));
    const page = items.slice(start, start + size);
    return {
      items: page,
      nextCursor: start + size < items.length ? String(page.at(-1)!.id) : null,
    };
  }),
  get('/api/v1/admin/audit-logs/filters', () => ({
    admins: [...adminIds].map(([name, id]) => ({ id, name })),
    actionTypes: ACTION_TYPES,
  })),
];
