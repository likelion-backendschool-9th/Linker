import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo/metadata';

import { CallbackFlow } from './callback-flow';

export const metadata: Metadata = buildMetadata({ title: '로그인 확인', path: '/auth/callback' });

export default async function AuthCallbackPage({ searchParams }: PageProps<'/auth/callback'>) {
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  return (
    <CallbackFlow
      code={first(query.code) ?? ''}
      state={first(query.state) ?? ''}
      returnTo={first(query.returnTo) ?? '/feed'}
      errorCode={first(query.error) ?? ''}
      client={first(query.client) ?? 'web'}
    />
  );
}
