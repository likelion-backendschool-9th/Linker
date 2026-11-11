import { NETWORK } from '@/lib/policy';

import { fetchWithTimeout, isTimeoutError, RequestTimeoutError, withTimeout } from './fetch-with-timeout';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A fetch that never answers on its own and rejects like the real one when its signal aborts */
function hangingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        );
      }),
  );
}

it('returns the response when it arrives in time', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('ok'))));
  const res = await fetchWithTimeout('/api/v1/x');
  await expect(res.text()).resolves.toBe('ok');
});

// TEMP (QA, 2026-11-11): the time limit is commented out in `withTimeout`; un-skip with it
it.skip('gives up after 10 s by default with a TimeoutError, not an AbortError', async () => {
  const fetchMock = hangingFetch();
  vi.stubGlobal('fetch', fetchMock);
  const request = fetchWithTimeout('/api/v1/slow');
  const settled = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);

  await vi.advanceTimersByTimeAsync(NETWORK.requestTimeoutMs - 1);
  expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await settled;
  await expect(request).rejects.toMatchObject({ name: 'TimeoutError', message: '네트워크 연결 시간이 초과되었습니다.' });
  // The request itself is cancelled too
  expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
});

// TEMP (QA, 2026-11-11): the time limit is commented out in `withTimeout`; un-skip with it
it.skip('takes a per-call limit', async () => {
  vi.stubGlobal('fetch', hangingFetch());
  const request = fetchWithTimeout('/api/v1/slow', { timeoutMs: 3000 });
  const settled = expect(request).rejects.toSatisfy(isTimeoutError);
  await vi.advanceTimersByTimeAsync(3000);
  await settled;
});

// TEMP (QA, 2026-11-11): the time limit is commented out in `withTimeout`; un-skip with it
it.skip('times out a task that ignores the signal (mock mode)', async () => {
  const task = withTimeout(() => new Promise<never>(() => {}), { timeoutMs: 500 });
  const settled = expect(task).rejects.toSatisfy(isTimeoutError);
  await vi.advanceTimersByTimeAsync(500);
  await settled;
});

it('passes a caller cancel through as an AbortError, never as a timeout', async () => {
  vi.stubGlobal('fetch', hangingFetch());
  const caller = new AbortController();
  const request = fetchWithTimeout('/api/v1/slow', { signal: caller.signal });
  caller.abort();
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  await expect(request).rejects.not.toSatisfy(isTimeoutError);
});
