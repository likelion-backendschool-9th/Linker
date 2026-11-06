import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

/** WBS 26 provisional read contracts. No sanctions, reveal, or refund writes. */
export type AdminUser = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
  userType: 'DEVELOPER' | 'RECRUITER';
  emailMasked: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWING' | 'DELETED';
  needsReview: boolean;
  joinedAt: string;
};
export type AdminUserDetail = AdminUser & {
  allowedActions: { permanentSanction: boolean; liftSanction: boolean; refund: boolean };
  sanctions: {
    id: number;
    step: string;
    reason: string;
    startsAt: string;
    endsAt: string | null;
  }[];
  reportHistory: { caseId: number; targetType: string; result: string; at: string }[];
  subscription: { plan: string; status: string } | null;
  payments: { id: number; amount: number; status: string; paidAt: string }[];
  recruiter: {
    company: string;
    domain: string;
    jobTitle: string;
    offersSent30d: number;
    offersAccepted30d: number;
  } | null;
};
export function adminUsersOptions(filters: {
  q: string;
  status: string;
  userType: string;
  needsReview: boolean;
}) {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
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
      return apiFetch<{ items: AdminUser[]; nextCursor: string | null }>(
        `/api/v1/admin/users?${params}`,
        { signal },
      );
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
export function adminUserOptions(id: string | null) {
  return queryOptions({
    queryKey: ['admin-user', id],
    enabled: !!id,
    queryFn: ({ signal }) =>
      apiFetch<AdminUserDetail>(`/api/v1/admin/users/${encodeURIComponent(id!)}`, { signal }),
    gcTime: 0,
  });
}
