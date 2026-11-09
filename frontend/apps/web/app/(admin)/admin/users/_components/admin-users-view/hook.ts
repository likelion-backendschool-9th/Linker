'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { adminUsersOptions } from './api';
import type { ActionDraft } from '../admin-user-action-sheet/api';

export function useAdminUsersView() {
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    status: parseAsStringLiteral([
      '',
      'ACTIVE',
      'SUSPENDED',
      'WITHDRAWING',
      'DELETED',
    ] as const).withDefault(''),
    userType: parseAsStringLiteral(['', 'DEVELOPER', 'RECRUITER'] as const).withDefault(''),
    needsReview: parseAsBoolean.withDefault(false),
    user: parseAsString,
    userTab: parseAsStringLiteral(['basic', 'sanctions', 'reports', 'payments'] as const),
  });
  const [draft, setDraft] = useState<ActionDraft>();
  const [revision, setRevision] = useState(0);
  const action = useOverlay('admin-user-action');
  const users = useInfiniteQuery(adminUsersOptions(filters));
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, Math.max(0, (users.data?.pages.length ?? 1) - 1));
  const items = users.data?.pages[currentPage]?.items ?? [];
  const desktop = useMediaQuery('(min-width: 1024px)');
  const overlay = useOverlay('admin-user-detail');
  const selected = overlay.id ?? filters.user ?? (desktop && items[0] ? String(items[0].id) : null);
  const reviewSupported = users.data?.pages[0]?.reviewFilterSupported === true;
  function changeFilters(next: Partial<typeof filters>) {
    setPage(0);
    void setFilters({ ...next, user: null, userTab: null });
  }
  async function nextPage() {
    if (users.isFetchingNextPage) return;
    if (currentPage < (users.data?.pages.length ?? 0) - 1) setPage(currentPage + 1);
    else if (users.hasNextPage) {
      const result = await users.fetchNextPage();
      if (!result.isError) setPage(currentPage + 1);
    }
    void setFilters({ user: null });
  }
  return {
    filters,
    changeFilters,
    users,
    items,
    desktop,
    overlay,
    selected,
    reviewSupported,
    draft,
    setDraft,
    revision,
    action,
    page: currentPage,
    hasNext: currentPage < (users.data?.pages.length ?? 0) - 1 || users.hasNextPage,
    handlers: {
      onApplied() {
        setDraft(undefined);
        setRevision((value) => value + 1);
      },
      select(id: number) {
        if (desktop) void setFilters({ user: String(id), userTab: null });
        else overlay.open(String(id));
      },
      previousPage() {
        setPage(Math.max(0, currentPage - 1));
        void setFilters({ user: null });
      },
      nextPage,
      resetFilters() {
        changeFilters({ q: '', status: '', userType: '', needsReview: false });
      },
    },
  };
}
