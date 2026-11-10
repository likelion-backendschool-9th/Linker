import { apiFetch } from '@/lib/api/api-fetch';

// Keep the page-local transport until p27 is included in the generated client.
export type AuditLog = {
  id: number;
  adminId: number;
  admin: string;
  actionType: string;
  targetType: string;
  targetId: number | null;
  target: string;
  reason: string | null;
  createdAt: string;
  sanctionStep: string | null;
};
export type AuditFilters = { admins: { id: number; name: string }[]; actionTypes: string[] };
export type AuditFiltersState = { adminId: string; actionType: string; from: string; to: string };
export function fetchAuditFilters(signal?: AbortSignal) {
  return apiFetch<AuditFilters>('/api/v1/admin/audit-logs/filters', { signal, cache: 'no-store' });
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
    { signal, cache: 'no-store' },
  );
}
