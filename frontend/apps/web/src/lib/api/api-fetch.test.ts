import { mockFetch } from '@/mocks/mock-fetch';

import { ApiError } from './api-error';
import { apiFetch } from './api-fetch';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: () => 'session=1' })),
}));

vi.mock('@/mocks/mock-fetch', () => ({
  mockFetch: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.mocked(mockFetch).mockReset();
  });

  it('prefixes the public base and sends cookies in the browser', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://public.example');
    const fetchMock = vi.fn(async () => jsonResponse({ type: 'DEVELOPER' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/v1/user/me')).resolves.toEqual({ type: 'DEVELOPER' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://public.example/api/v1/user/me',
      expect.objectContaining({ credentials: 'include' }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).has('cookie')).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses the internal base and forwards the request cookies on the server', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://backend:8080');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://public.example');
    const fetchMock = vi.fn(async () => jsonResponse({ type: 'DEVELOPER' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', undefined);

    await apiFetch('/api/v1/user/me');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:8080/api/v1/user/me',
      expect.objectContaining({ credentials: undefined }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('cookie')).toBe('session=1');
  });

  it('returns undefined for 204 and throws ApiError for a failure body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse(
          { code: 'LOGIN_REQUIRED', message: '로그인이 필요해요', detail: { a: 1 } },
          401,
        ),
      )
      .mockResolvedValueOnce(new Response('nope', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/v1/user/blocks', { method: 'POST' })).resolves.toBeUndefined();

    await expect(apiFetch('/api/v1/user/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'LOGIN_REQUIRED',
      message: '로그인이 필요해요',
      detail: { a: 1 },
    });

    const unknown = apiFetch('/api/v1/user/me');
    await expect(unknown).rejects.toBeInstanceOf(ApiError);
    await expect(unknown).rejects.toMatchObject({
      status: 500,
      code: 'UNKNOWN',
      message: '잠시 후 다시 시도해 주세요',
    });
  });

  it('answers from the mock layer when mock mode is on', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
    vi.mocked(mockFetch).mockResolvedValue({ type: 'GUEST' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/v1/user/me')).resolves.toEqual({ type: 'GUEST' });

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/user/me', {});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
