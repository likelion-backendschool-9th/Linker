import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { TeamFrame } from '../_components/team-frame/TeamFrame';
import { TeamChangeIconButton } from '../_components/team-change-icon-button';
import { TeamSettingsView } from './_components/team-settings-view/TeamSettingsView';
import { membersOptions, settingsOptions } from './_lib/settings-queries';

export const metadata = buildMetadata({ title: '팀 설정' });

export default async function TeamSettingsPage({ params }: PageProps<'/teams/[id]/settings'>) {
  const { id } = await params;
  const client = getQueryClient();
  await Promise.all([
    client.prefetchQuery(settingsOptions(id)),
    client.prefetchQuery(membersOptions(id)),
  ]);
  return (
    <TeamFrame teamId={id} title="팀 설정" actions={<TeamChangeIconButton />}>
      <HydrationBoundary state={dehydrate(client)}>
        <TeamSettingsView teamId={id} />
      </HydrationBoundary>
    </TeamFrame>
  );
}
