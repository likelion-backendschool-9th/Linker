import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ApiError } from '@/lib/api/api-error';
import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { issueDetailOptions } from '../../_lib/issue-detail-queries';
import { IssueDetailView } from './_components/issue-detail-view/IssueDetailView';

// No issue title in metadata: team pages are private (frontend AGENTS.md "SEO and privacy")
export const metadata = buildMetadata({ title: '이슈 상세' });

/** 12 Issue detail (07 TODO 12, `IssueController`), Figma 12 (198:486). `[issueId]` is the Linker issue id. */
export default async function IssueDetailPage({
  params,
}: PageProps<'/teams/[id]/issues/[issueId]'>) {
  const { id, issueId } = await params;
  const client = getQueryClient();

  let issue;
  try {
    issue = await client.fetchQuery(issueDetailOptions(id, issueId));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  // Deleted on GitHub → unavailable content; transferred → follow to the new location (04 ch. 7 exceptions)
  if (issue.deletedOrMoved === 'DELETED') notFound();
  if (issue.deletedOrMoved === 'MOVED' && issue.movedToIssueId !== null) {
    redirect(`/teams/${id}/issues/${issue.movedToIssueId}` as Route);
  }

  return (
    <PageFrame title="이슈 상세" variant="stack" backHref={`/teams/${id}/issues` as Route}>
      <HydrationBoundary state={dehydrate(client)}>
        <IssueDetailView teamId={id} issueId={issueId} />
      </HydrationBoundary>
    </PageFrame>
  );
}
