'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';

import { useMediaQuery } from '@/hooks/use-media-query';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { adminUsersOptions } from './api';

export function useAdminUsersView() {
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    status: parseAsStringLiteral(['', 'ACTIVE', 'SUSPENDED', 'WITHDRAWING'] as const).withDefault(
      '',
    ),
    userType: parseAsStringLiteral(['', 'DEVELOPER', 'RECRUITER'] as const).withDefault(''),
    needsReview: parseAsBoolean.withDefault(false),
    user: parseAsString,
  });
  const users = useInfiniteQuery(adminUsersOptions(filters));
  const items = users.data?.pages.flatMap((page) => page.items) ?? [];
  const desktop = useMediaQuery('(min-width: 1024px)');
  const overlay = useOverlay('admin-user-detail');
  const selected = overlay.id ?? filters.user;

  function select(id: number) {
    if (desktop) void setFilters({ user: String(id) });
    else overlay.open(String(id));
  }

  function resetFilters() {
    void setFilters({ q: '', status: '', userType: '', needsReview: false, user: null });
  }

  return {
    filters,
    setFilters,
    users,
    items,
    desktop,
    overlay,
    selected,
    handlers: {
      select,
      resetFilters,
    },
  };
}
