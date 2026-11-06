import { apiFetch } from '@/lib/api/api-fetch';

export type AuditLog = {
  id: number;
  admin: string;
  actionType: string;
  target: string;
  reason: string;
  createdAt: string;
};

export type AuditFilters = {
  admins: { id: string; name: string }[];
  actionTypes: string[];
};

export type AuditFiltersState = {
  adminId: string;
  actionType: string;
  from: string;
  to: string;
};

export function fetchAuditFilters(signal?: AbortSignal) {
  return apiFetch<AuditFilters>('/api/v1/admin/audit-logs/filters', { signal });
}

export function fetchAuditLogs(
  filters: AuditFiltersState,
  cursor: string | null,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (filters.adminId) params.set('adminId', filters.adminId);
  if (filters.actionType) params.set('actionType', filters.actionType);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (cursor) params.set('cursor', cursor);
  params.set('size', '20');
  return apiFetch<{ items: AuditLog[]; nextCursor: string | null }>(
    `/api/v1/admin/audit-logs?${params}`,
    { signal },
  );
}
