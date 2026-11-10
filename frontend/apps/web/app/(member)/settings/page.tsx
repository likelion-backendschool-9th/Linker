import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { apiFetch } from '@/lib/api/api-fetch';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { DeveloperSettingsView } from './_views/DeveloperSettingsView';
import { RecruiterSettingsView } from './_views/RecruiterSettingsView';
import type { SettingsData } from './_lib/settings-types';

export const metadata: Metadata = buildMetadata({ title: '설정', path: '/settings' });

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/feed');
  const settings = await apiFetch<SettingsData>('/api/v1/user/me/settings');
  const blocks = await apiFetch<{ user: { id: number } }[]>('/api/v1/user/me/blocks');
  const profile =
    session.userType === 'RECRUITER'
      ? null
      : await apiFetch<{ jobStatus: 'SEEKING' | 'OPEN' | 'OFF' }>('/api/v1/user/me/profile');

  return (
    <PageFrame title="설정" variant="stack" backHref="/feed">
      {session.userType === 'RECRUITER' ? (
        <RecruiterSettingsView login={session.login} settings={settings} blockCount={Array.isArray(blocks) ? blocks.length : 0} />
      ) : (
        <DeveloperSettingsView login={session.login} settings={settings} jobStatus={profile?.jobStatus ?? 'OFF'} blockCount={Array.isArray(blocks) ? blocks.length : 0} />
      )}
    </PageFrame>
  );
}
