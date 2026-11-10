'use client';

import { useEffect } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { useViewer } from '@/lib/auth/viewer-context';
import { useAppSignalStore } from '@/stores/app-signal-store';

import { accountClaimsMatch, type AccountClaims } from '../session-claims';
import { useAccountSessionRefresh } from '../use-account-session-refresh';

/**
 * The layout session is fixed until the next request. After an operator assignment or a
 * suspension change, `/me` already sees the new row (opaque cookie). This reloads the layout
 * and clears the query cache so the open tab matches it.
 */
export function SessionClaimSync() {
  const viewer = useViewer();
  const refreshSession = useAccountSessionRefresh();
  const { role, status, suspendedUntil } = viewer;

  useEffect(() => {
    if (role === 'guest') return;
    let active = true;

    async function check() {
      try {
        const me = await apiFetch<AccountClaims>('/api/v1/user/me');
        if (!active) return;
        const current = { role, login: null, status, suspendedUntil };
        if (accountClaimsMatch(current, me)) return;
        if (me.status !== 'SUSPENDED') useAppSignalStore.setState({ suspended: false });
        refreshSession();
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) refreshSession();
      }
    }

    void check();
    window.addEventListener('focus', check);
    return () => {
      active = false;
      window.removeEventListener('focus', check);
    };
  }, [refreshSession, role, status, suspendedUntil]);

  return null;
}
