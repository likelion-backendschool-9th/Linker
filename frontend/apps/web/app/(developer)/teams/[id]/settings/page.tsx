import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';

import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { TeamFrame } from '../_components/team-frame/TeamFrame';
import { TeamSettingsView } from './_components/team-settings-view/TeamSettingsView';
import styles from './_components/team-settings-view/TeamSettingsView.module.css';
import { membersOptions, settingsOptions } from './_lib/settings-queries';

export const metadata = buildMetadata({ title: '팀 설정' });

/** Visual-only header icon matching Figma 368:404 (sliders-horizontal). */
function SettingsHeaderIcon() {
  return (
    <span className={styles.headerIcon} aria-hidden>
      <SlidersHorizontal />
    </span>
  );
}

export default async function TeamSettingsPage({ params }: PageProps<'/teams/[id]/settings'>) {
  const { id } = await params;
  const client = getQueryClient();
  await Promise.all([
    client.prefetchQuery(settingsOptions(id)),
    client.prefetchQuery(membersOptions(id)),
  ]);
  return (
    <TeamFrame teamId={id} title="팀 설정" actions={<SettingsHeaderIcon />}>
      <HydrationBoundary state={dehydrate(client)}>
        <TeamSettingsView teamId={id} />
      </HydrationBoundary>
    </TeamFrame>
  );
}
