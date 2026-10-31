import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruiterLoginForm } from './_components/recruiter-login-form';

export const metadata: Metadata = buildMetadata({ title: '채용 담당자 로그인', path: '/recruiter/login' });

export default async function RecruiterLoginPage({ searchParams }: PageProps<'/recruiter/login'>) {
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const returnTo = first(query.returnTo) ?? '/feed';

  return (
    <PageFrame title="채용 담당자 로그인" variant="stack" backHref="/" bottomTabs={false}>
      <RecruiterLoginForm returnTo={returnTo} />
    </PageFrame>
  );
}
