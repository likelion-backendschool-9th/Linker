import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageFrame } from '@/components/layout/page-frame';
import { apiFetch } from '@/lib/api/api-fetch';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { DeveloperSettingsView } from './_views/developer-settings-view';
import { RecruiterSettingsView } from './_views/recruiter-settings-view';
import type { SettingsData } from './_lib/settings-types';

export const metadata: Metadata = buildMetadata({ title: '설정', path: '/settings' });

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/feed');
  const settings = await apiFetch<SettingsData>('/api/v1/user/me/settings');

  return (
    <PageFrame title="설정" variant="stack" backHref="/feed">
      {session.userType === 'RECRUITER' ? (
        <RecruiterSettingsView login={session.login} settings={settings} />
      ) : (
        <DeveloperSettingsView login={session.login} settings={settings} />
      )}
    </PageFrame>
  );
}
