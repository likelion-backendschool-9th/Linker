import type { Route } from 'next';

/** Cross-owner URL contracts. C's route is supplied by PR #35, not reimplemented by B. */
export const collaborationLinks = {
  myIssues: '/workspace/issues' as Route,
  myStats: '/me/stats' as Route,
  handledReports: '/admin/reports?tab=reports&status=HANDLED' as Route,
};

/** Page 22 uses teamId to narrow its repository list and preselect a single available repo. */
export function teamPostCreateHref(teamId: number): Route {
  return `/posts/new?${new URLSearchParams({ teamId: String(teamId) })}` as Route;
}

export function profileHref(login: string): Route {
  return `/users/${encodeURIComponent(login)}` as Route;
}

export function teamPlanHref(teamId: number, plan: 'FREE' | 'FLEX'): Route {
  const params = new URLSearchParams({ returnTo: `/teams/${teamId}/settings` });
  if (plan === 'FLEX') return `/settings/subscription?${params}` as Route;
  params.set('reason', 'team-members');
  params.set('teamId', String(teamId));
  return `/subscribe?${params}` as Route;
}

export function statsPlanHref(): Route {
  return `/subscribe?${new URLSearchParams({ reason: 'stats', returnTo: '/me/stats' })}` as Route;
}
