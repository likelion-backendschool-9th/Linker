import { apiFetch } from '@/lib/api/api-fetch';

export type ReportStatus = 'PENDING' | 'HANDLED' | 'APPEALED';
export type ReportTargetType =
  | 'USER'
  | 'POST'
  | 'COMMENT'
  | 'RECRUIT_POST'
  | 'TEAM_MESSAGE'
  | 'DIRECT_MESSAGE'
  | 'RECRUITER_AD';
export type ReportAction = 'HIDE' | 'DELETE' | 'DISMISS' | 'RESTORE';
export type ReportCase = {
  id: number;
  status: ReportStatus;
  targetType: ReportTargetType;
  targetSummary: string;
  reasons: { reason: string; count: number }[];
  reporterCount: number;
  autoHidden: boolean;
  receivedAt: string;
  overdue: boolean;
  target: {
    id: number;
    login: string;
    name: string;
    avatarUrl: string;
    userType: 'DEVELOPER' | 'RECRUITER';
    jobStatus: string;
  };
  chatContext: { sender: string; text: string; reported?: boolean }[] | null;
  handledAction: string | null;
};
export type ReportList = { items: ReportCase[] };
export type Appeal = {
  id: number;
  status: 'PENDING' | 'DECIDED';
  user: {
    id: number;
    login: string;
    name: string;
    avatarUrl: string;
    userType: string;
    jobStatus: string;
  };
  caseId: number;
  reason: string;
  createdAt: string;
  originalHandler: string;
};
export type AppealList = { items: Appeal[] };

export function fetchReportCases(params: {
  status: ReportStatus;
  targetType: string;
  overdue: string;
}) {
  const search = new URLSearchParams();
  search.set('status', params.status);
  if (params.targetType !== 'ALL') search.set('targetType', params.targetType);
  if (params.overdue === 'true') search.set('overdue', 'true');
  return apiFetch<ReportList>(`/api/v1/admin/report-cases?${search.toString()}`);
}

export function fetchReportCase(id: number) {
  return apiFetch<ReportCase>(`/api/v1/admin/report-cases/${id}`);
}

export function fetchPendingAppeals() {
  return apiFetch<AppealList>('/api/v1/admin/appeals?status=PENDING');
}

export function processReportCase(id: number, action: ReportAction, note: string) {
  return apiFetch<ReportCase>(`/api/v1/admin/report-cases/${id}/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...(note.trim() ? { reason: note.trim() } : {}) }),
  });
}

export function decideAppeal(id: number, accept: boolean, note: string) {
  return apiFetch<void>(`/api/v1/admin/appeals/${id}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accept, reason: note.trim() }),
  });
}
