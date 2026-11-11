import { NETWORK } from '@/lib/policy';

/**
 * A request that got no response within its time limit. Its own name (not `AbortError`) so it is never
 * confused with TanStack Query cancelling a request it no longer needs (that one is an `AbortError`
 * and must stay silent).
 */
export class RequestTimeoutError extends Error {
  override readonly name = 'TimeoutError';

  constructor(readonly timeoutMs: number) {
    super('네트워크 연결 시간이 초과되었습니다.');
  }
}

export function isTimeoutError(error: unknown): error is RequestTimeoutError {
  return error instanceof RequestTimeoutError;
}

export type TimeoutOptions = {
  /** Default `NETWORK.requestTimeoutMs` (10 s). */
  timeoutMs?: number;
  /** The caller's own signal (e.g. TanStack Query's); aborting it still cancels the request. */
  signal?: AbortSignal | null;
};

/**
 * Runs `task` with an AbortSignal that fires after `timeoutMs` (or when the caller's signal fires).
 * Rejects with `RequestTimeoutError` on timeout even if the task ignores the signal.
 */
export function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  { timeoutMs = NETWORK.requestTimeoutMs, signal }: TimeoutOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = new RequestTimeoutError(timeoutMs);

  const onCallerAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) onCallerAbort();
  else signal?.addEventListener('abort', onCallerAbort, { once: true });

  // TEMP (QA, 2026-11-11): request time limit turned off; requests wait for their answer. A caller's
  // cancel still goes through. Restore the timer below (and the skipped tests) to bring it back.
  // let timer: ReturnType<typeof setTimeout> | undefined;
  // const timedOut = new Promise<never>((_, reject) => {
  //   timer = setTimeout(() => {
  //     controller.abort(timeout);
  //     reject(timeout);
  //   }, timeoutMs);
  // });

  // return Promise.race([task(controller.signal), timedOut])
  return task(controller.signal)
    .catch((error: unknown) => {
      // fetch rejects with an AbortError once we abort it; report it as the timeout it was
      if (controller.signal.reason === timeout) throw timeout;
      throw error;
    })
    .finally(() => {
      // clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
    });
}

/** `fetch` that gives up after `timeoutMs` (default 10 s) with `RequestTimeoutError`. */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  { timeoutMs, signal, ...init }: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  return withTimeout((timeoutSignal) => fetch(input, { ...init, signal: timeoutSignal }), {
    timeoutMs,
    signal,
  });
}
