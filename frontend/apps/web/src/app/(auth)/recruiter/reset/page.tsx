import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruiterResetFlow } from './_components/recruiter-reset-flow';

export const metadata: Metadata = buildMetadata({ title: '채용 담당자 비밀번호 재설정', path: '/recruiter/reset' });

export default async function RecruiterResetPage({ searchParams }: PageProps<'/recruiter/reset'>) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;

  return (
    <PageFrame title="비밀번호 재설정" variant="stack" backHref="/recruiter/login" bottomTabs={false}>
      <RecruiterResetFlow token={token ?? ''} />
    </PageFrame>
  );
}
