import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';

// The p26 client is not generated yet; use the existing transport and server DTOs.
export type AdminUser = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string | null;
  userType: 'DEVELOPER' | 'RECRUITER';
  emailMasked: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWING' | 'DELETED';
  needsReview: boolean | null;
  joinedAt: string;
};
export type AdminUserDetail = Omit<AdminUser, 'needsReview'> & {
  allowedActions: { permanentSanction: boolean; liftSanction: boolean; refund: boolean };
  sanctions: {
    id: number;
    step: string;
    reason: string | null;
    reasonCode: string | null;
    startsAt: string;
    endsAt: string | null;
    revokedAt: string | null;
    active: boolean;
  }[];
  reportHistory: { caseId: number; targetType: string; result: string; at: string }[];
  subscriptions: {
    id: number;
    plan: string;
    status: string;
    teamId: number | null;
    periodEnd: string;
  }[];
  payments: {
    id: number;
    amount: number;
    status: string;
    paidAt: string | null;
    refundedAmount: number;
  }[];
  recruiter: {
    company: string;
    domain: string;
    jobTitle: string;
    offersSent30d: number;
    offersAccepted30d: number;
  } | null;
};
export type AdminUsersFilters = {
  q: string;
  status: string;
  userType: string;
  needsReview: boolean;
};
export function adminUsersOptions(filters: AdminUsersFilters) {
  const query = new URLSearchParams();
  if (filters.q.trim()) query.set('q', filters.q.trim());
  if (filters.status) query.set('status', filters.status);
  if (filters.userType) query.set('userType', filters.userType);
  if (filters.needsReview) query.set('needsReview', 'true');
  return infiniteQueryOptions({
    queryKey: ['admin-users', filters.q, filters.status, filters.userType, filters.needsReview],
    initialPageParam: null as string | null,
    queryFn: ({ signal, pageParam }) => {
      const params = new URLSearchParams(query);
      params.set('size', '20');
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<{
        items: AdminUser[];
        nextCursor: string | null;
        reviewFilterSupported: boolean;
      }>(`/api/v1/admin/users?${params}`, { signal, cache: 'no-store' });
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
export function adminUserOptions(id: string | null) {
  return queryOptions({
    queryKey: ['admin-user', id],
    enabled: !!id,
    queryFn: ({ signal }) =>
      apiFetch<AdminUserDetail>(`/api/v1/admin/users/${encodeURIComponent(id!)}`, {
        signal,
        cache: 'no-store',
      }),
    gcTime: 0,
  });
}
export const STATUS_LABELS: Record<AdminUser['status'], string> = {
  ACTIVE: '활성',
  SUSPENDED: '정지',
  WITHDRAWING: '삭제 대기',
  DELETED: '삭제',
};
export const SANCTION_LABELS: Record<string, string> = {
  WARNING: '경고',
  DAYS_7: '7일 이용 제한',
  DAYS_30: '30일 이용 제한',
  PERMANENT: '영구 정지',
  REPORT_RESTRICTION: '신고 제한',
};
