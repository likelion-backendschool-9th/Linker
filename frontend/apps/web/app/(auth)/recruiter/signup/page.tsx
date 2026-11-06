import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruiterSignupForm } from './_components/recruiter-signup-form/RecruiterSignupForm';

export const metadata: Metadata = buildMetadata({ title: '채용 담당자 회원가입', path: '/recruiter/signup' });

export default function RecruiterSignupPage() {
  return (
    <PageFrame title="채용 담당자 회원가입" variant="stack" backHref="/recruiter/login" bottomTabs={false}>
      <RecruiterSignupForm />
    </PageFrame>
  );
}
