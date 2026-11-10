import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { TeamChangeIconButton } from '../_components/team-change-icon-button';
import { TeamFrame } from '../_components/team-frame/TeamFrame';
import { loadIssueFilters } from '../_lib/issue-filters';
import { CalendarView } from './_components/calendar-view';
import {
  anchorOf,
  calendarOptions,
  calendarRange,
  loadCalendarParams,
} from './_lib/calendar-queries';

export const metadata = buildMetadata({ title: '캘린더' });

/** 15 Calendar (07 TODO 15, `IssueController`), Figma 15 (234:219) */
export default async function CalendarPage({
  params,
  searchParams,
}: PageProps<'/teams/[id]/calendar'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { date } = loadCalendarParams(query);
  const { assignee } = loadIssueFilters(query);
  const { from, to } = calendarRange('month', anchorOf(date));
  const client = getQueryClient();
  await client.prefetchQuery(calendarOptions(id, from, to, assignee));

  return (
    <TeamFrame teamId={id} title="캘린더" actions={<TeamChangeIconButton />}>
      <HydrationBoundary state={dehydrate(client)}>
        <CalendarView teamId={id} />
      </HydrationBoundary>
    </TeamFrame>
  );
}
