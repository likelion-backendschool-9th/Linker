import { create } from 'zustand';

/**
 * Signals raised by shared API error handling (blueprint §5-4) for UI that lives in React:
 * the login/limit sheets open from `ApiErrorEffects`, banners read the flags.
 * Browser only: the server QueryClient never writes here.
 */
type AppSignalState = {
  /** Bumped on LOGIN_REQUIRED; `ApiErrorEffects` opens the login sheet on change */
  loginRequestedAt: number;
  /** PLAN_LIMIT detail for the limit sheet; set right before the sheet opens */
  planLimit: { reason: string; message: string } | null;
  githubUnavailable: boolean;
  /** SUSPENDED from an API call after the page loaded (the layout covers the initial case) */
  suspended: boolean;
  /** Set when a query timed out while a loading orb was up; `LoadTimeoutScreen` shows Figma 301:326 */
  loadTimedOutAt: number;
  /** How many loading orbs (`PageLoading`, `Skeleton`) are on screen right now */
  loadersMounted: number;
};

export const useAppSignalStore = create<AppSignalState>(() => ({
  loginRequestedAt: 0,
  planLimit: null,
  githubUnavailable: false,
  suspended: false,
  loadTimedOutAt: 0,
  loadersMounted: 0,
}));
