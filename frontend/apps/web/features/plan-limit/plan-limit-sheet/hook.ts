/** Event and behavior hooks for PlanLimitSheet. */
import type { Route } from 'next';

/** Overlay params belong to the sheet itself, not to the screen the user returns to. */
const OVERLAY_PARAMS = ['overlay', 'oid'];

/**
 * `/subscribe?reason=` plus the screen that hit the limit as `returnTo`, so 28's success, fail and back
 * lead back to it (07 TODO 28; Issue #123). The subscribe pages themselves are never a return target.
 */
export function planLimitSubscribeHref(reason: string, current: string): Route {
  const params = new URLSearchParams();
  if (reason) params.set('reason', reason);
  const here = new URL(current, 'https://linker.invalid');
  OVERLAY_PARAMS.forEach((key) => here.searchParams.delete(key));
  const back = `${here.pathname}${here.search}`;
  if (!/^\/subscribe(\/|$)/.test(here.pathname)) params.set('returnTo', back);
  const query = params.toString();
  return (query ? `/subscribe?${query}` : '/subscribe') as Route;
}
