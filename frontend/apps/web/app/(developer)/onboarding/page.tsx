import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { apiFetch } from '@/lib/api/api-fetch';
import { PROFILE } from '@/lib/policy';
import { buildMetadata } from '@/lib/seo/metadata';

import { OnboardingForm } from './_components/onboarding-form/OnboardingForm';

export const metadata: Metadata = buildMetadata({ title: '개발자 온보딩', path: '/onboarding' });

type OnboardingResponse = {
  done: boolean;
  step: 'AGREEMENTS' | 'PROFILE' | 'EMAIL';
  defaults: {
    name: string;
    bio: string;
    blogUrl: string;
    techStack: string[];
    lookingForTeam: boolean;
    jobStatus: 'SEEKING' | 'OPEN' | 'OFF';
  };
  emailRequired: boolean;
  termsVersion: string;
};

type TechTag = { id: number; name: string };

export default async function OnboardingPage() {
  const [initial, techTags] = await Promise.all([
    apiFetch<OnboardingResponse>('/api/v1/user/onboarding'),
    apiFetch<TechTag[]>('/api/v1/public/tech-tags'),
  ]);

  if (initial.done) {
    return (
      <PageFrame title="온보딩 완료" variant="stack" bottomTabs={false}>
        <p>프로필 설정이 완료됐어요.</p>
      </PageFrame>
    );
  }

  return (
    <PageFrame title="프로필 설정" variant="stack" bottomTabs={false}>
      <OnboardingForm initial={initial} techTags={techTags} techStackMax={PROFILE.techStackMax} />
    </PageFrame>
  );
}
