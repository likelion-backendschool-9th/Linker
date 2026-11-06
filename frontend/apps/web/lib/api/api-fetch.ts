import { ApiError } from './api-error';

/** orval mutator. Works on the server and in the browser (blueprint §5-4). */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  // Mock mode (blueprint §1-2): answered from src/mocks/, never reaches Spring
  // Written out (not the shared USE_MOCKS const) so the bundler can drop this branch and the mock code
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    const { mockFetch } = await import('@/mocks/mock-fetch');
    return mockFetch<T>(url, init);
  }

  const isServer = typeof globalThis.window === 'undefined';
  const headers = new Headers(init.headers);
  if (isServer) {
    const { cookies } = await import('next/headers');
    headers.set('cookie', (await cookies()).toString());
  }
  // Containers resolve Spring by service name; browsers use the public build-time origin.
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const baseUrl = isServer ? (process.env.API_INTERNAL_URL ?? publicBase) : publicBase;
  const res = await fetch(`${baseUrl}${url}`, {
    ...init,
    headers,
    credentials: isServer ? undefined : 'include',
  });
  if (!res.ok) throw await ApiError.from(res);
  return res.status === 204 ? (undefined as T) : res.json();
}
