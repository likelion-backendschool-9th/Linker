import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { StartScreen } from './_components/start-screen/StartScreen';

export const metadata: Metadata = buildMetadata({
  title: 'Linker 시작하기',
  path: '/',
  indexable: true,
});

export default async function StartPage() {
  if (await getSession()) redirect('/feed');
  return <StartScreen />;
}
