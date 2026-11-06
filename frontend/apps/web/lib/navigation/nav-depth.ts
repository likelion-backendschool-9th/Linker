import { safeSessionStorage } from '@/lib/browser/safe-storage';

/**
 * How many in-app entries sit behind the current one in this tab (blueprint §7-5).
 * 0 means "back would leave Linker", so `useAppBack` replaces to a fallback instead.
 * Counting errs low on purpose: a too-low depth stays in the app, a too-high one could exit it.
 * Overlay entries change only the query, so they never count.
 */

const KEY = 'linker:nav-depth';

type DepthState = { depth: number; historyLength: number; path: string };

let poppedToOtherPath = false;

function read(): DepthState {
  return safeSessionStorage.get<DepthState>(KEY) ?? { depth: 0, historyLength: 0, path: '' };
}

function write(state: DepthState) {
  safeSessionStorage.set(KEY, state);
}

export function getNavDepth(): number {
  return read().depth;
}

/** Document load: a fresh navigation (shared link, OAuth return) starts at 0; reload and back/forward keep it. */
export function initNavDepth(path: string) {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  const keep = entry?.type === 'reload' || entry?.type === 'back_forward';
  write({ depth: keep ? read().depth : 0, historyLength: window.history.length, path });
}

export function handlePopState() {
  const state = read();
  poppedToOtherPath = window.location.pathname !== state.path;
  write({ ...state, historyLength: window.history.length });
}

/** Runs after every pathname change: back lowers the depth, a push (history grew) raises it, a replace keeps it. */
export function handlePathChange(path: string) {
  const state = read();
  if (path === state.path) return;
  let depth = state.depth;
  if (poppedToOtherPath) depth = Math.max(0, depth - 1);
  else if (window.history.length > state.historyLength) depth += 1;
  poppedToOtherPath = false;
  write({ depth, historyLength: window.history.length, path });
}
