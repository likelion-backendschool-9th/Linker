import type { Route } from 'next';

/** Cross-owner URL contracts. C's route is supplied by PR #35, not reimplemented by B. */
export const collaborationLinks = {
  myIssues: '/workspace/issues' as Route,
  myStats: '/me/stats' as Route,
  handledReports: '/admin/reports?tab=reports&status=HANDLED' as Route,
  postCreate: '/posts/new' as Route,
};

export function profileHref(login: string): Route {
  return `/u/${encodeURIComponent(login)}` as Route;
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
