import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { TeamFrame } from '../_components/team-frame/TeamFrame';
import { issueFilterOptions } from '../_lib/issue-queries';
import { CalendarView } from './_components/calendar-view/CalendarView';
import {
  anchorOf,
  calendarOptions,
  calendarRange,
  loadCalendarParams,
} from './_lib/calendar-queries';

export const metadata = buildMetadata({ title: '캘린더' });

/** 15 Calendar (07 TODO 15, `IssueController`) */
export default async function CalendarPage({
  params,
  searchParams,
}: PageProps<'/teams/[id]/calendar'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { view, date, assignee } = loadCalendarParams(query);
  const { from, to } = calendarRange(view, anchorOf(date));
  const client = getQueryClient();
  await Promise.all([
    client.prefetchQuery(calendarOptions(id, from, to, assignee)),
    client.prefetchQuery(issueFilterOptions(id)),
  ]);

  return (
    <TeamFrame teamId={id} title="캘린더">
      <HydrationBoundary state={dehydrate(client)}>
        <CalendarView teamId={id} />
      </HydrationBoundary>
    </TeamFrame>
  );
}
