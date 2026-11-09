'use client';

import { toast } from '@/stores/toast-store';

import { NOT_IMPLEMENTED } from '../room-header-actions/api';

export function useAiSummaryFab() {
  return { onClick: () => toast(NOT_IMPLEMENTED) };
}
