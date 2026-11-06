'use client';

import { useQuery } from '@tanstack/react-query';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { adminUserOptions } from './api';

export const SANCTION_LABELS: Record<string, string> = {
  WARNING: '경고',
  DAYS_7: '7일 이용 제한',
  DAYS_30: '30일 이용 제한',
  PERMANENT: '영구 정지',
};

export function useAdminUserDetailPanel(userId: string) {
  const query = useQuery(adminUserOptions(userId));
  const action = useOverlay('admin-user-action');
  const detail = useOverlay('admin-user-detail');

  return {
    query,
    action,
    detail,
    handlers: {
      openRefund: (paymentId: number) => action.open(`refund:${userId}:${paymentId}`),
      openSanction: () => action.open(`sanction:${userId}`),
      openEmail: () => action.open(`email:${userId}`),
      openLift: () => action.open(`lift:${userId}`),
    },
  };
}
