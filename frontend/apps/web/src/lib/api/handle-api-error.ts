import { useAppSignalStore } from '@/stores/app-signal-store';
import { toast } from '@/stores/toast-store';

import { ApiError } from './api-error';

/**
 * Shared handling of the common failure codes (blueprint §5-4, WBS §1-4). Browser only.
 * Anything else is left to the screen that made the call.
 */
export function handleApiError(error: unknown) {
  if (!(error instanceof ApiError)) return;
  const signals = useAppSignalStore.setState;

  switch (error.code) {
    case 'LOGIN_REQUIRED':
      signals({ loginRequestedAt: Date.now() });
      break;
    case 'PLAN_LIMIT':
      signals({
        planLimit: { reason: String(error.detail?.reason ?? ''), message: error.message },
      });
      break;
    case 'RATE_LIMITED': {
      const seconds = Number(error.detail?.retryAfterSeconds);
      const wait = Number.isFinite(seconds) && seconds > 0 ? ` (${Math.ceil(seconds)}초 후)` : '';
      toast(`잠시 후 다시 시도해 주세요${wait}`, { tone: 'alert' });
      break;
    }
    case 'SUSPENDED':
      signals({ suspended: true });
      break;
    case 'GITHUB_UNAVAILABLE':
      signals({ githubUnavailable: true });
      break;
    case 'DEVELOPER_ONLY':
      // The button shouldn't exist for this role: a screen-branching bug (blueprint §4-5). Sentry later.
      console.error('DEVELOPER_ONLY reached the API', error);
      toast(error.message, { tone: 'alert' });
      break;
  }
}
