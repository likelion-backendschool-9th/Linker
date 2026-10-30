import { ApiError } from './api-error';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/** orval mutator. Works on the server and in the browser (blueprint §5-4). */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const isServer = typeof window === 'undefined';
  const headers = new Headers(init.headers);
  if (isServer) {
    const { cookies } = await import('next/headers');
    headers.set('cookie', (await cookies()).toString());
  }
  // Containers resolve Spring by service name; browsers use the public build-time origin.
  const baseUrl = isServer ? (process.env.API_INTERNAL_URL ?? API_BASE_URL) : API_BASE_URL;
  const res = await fetch(`${baseUrl}${url}`, {
    ...init,
    headers,
    credentials: isServer ? undefined : 'include',
  });
  if (!res.ok) throw await ApiError.from(res);
  return res.status === 204 ? (undefined as T) : res.json();
}
