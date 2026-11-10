import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { beforeEach, expect, it, vi } from 'vitest';

import type { IssueDetail } from '../../_lib/issue-detail-queries';

vi.mock('server-only', () => ({}));

const fetchQuery = vi.fn();

vi.mock('@/lib/api/query-client', () => ({
  getQueryClient: () => ({ fetchQuery }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    dehydrate: () => ({}),
    HydrationBoundary: ({ children }: { children: ReactNode }) => children,
  };
});

vi.mock('@/components/layout/page-frame/PageFrame', () => ({
  PageFrame: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./_components/issue-detail-view/IssueDetailView', () => ({
  IssueDetailView: () => null,
}));

import IssueDetailPage from './page';

const base = {
  id: 1015,
  teamId: 1,
  deletedOrMoved: null as IssueDetail['deletedOrMoved'],
  movedToIssueId: null as number | null,
};

function params(issueId = '1015') {
  return Promise.resolve({ id: '1', issueId });
}

beforeEach(() => {
  fetchQuery.mockReset();
  vi.mocked(notFound).mockReset().mockImplementation(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  });
  vi.mocked(redirect).mockReset().mockImplementation((href: string) => {
    throw new Error(`NEXT_REDIRECT;${href}`);
  });
});

it('calls notFound when the issue was moved and the destination is unknown', async () => {
  fetchQuery.mockResolvedValue({
    ...base,
    deletedOrMoved: 'MOVED',
    movedToIssueId: null,
  });
  await expect(IssueDetailPage({ params: params() })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(notFound).toHaveBeenCalledOnce();
  expect(redirect).not.toHaveBeenCalled();
});

it('redirects to the new issue when movedToIssueId is present', async () => {
  fetchQuery.mockResolvedValue({
    ...base,
    deletedOrMoved: 'MOVED',
    movedToIssueId: 2099,
  });
  await expect(IssueDetailPage({ params: params() })).rejects.toThrow(
    'NEXT_REDIRECT;/teams/1/issues/2099',
  );
  expect(redirect).toHaveBeenCalledWith('/teams/1/issues/2099');
  expect(notFound).not.toHaveBeenCalled();
});

it('calls notFound when deletedOrMoved is DELETED', async () => {
  fetchQuery.mockResolvedValue({
    ...base,
    deletedOrMoved: 'DELETED',
    movedToIssueId: null,
  });
  await expect(IssueDetailPage({ params: params() })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(notFound).toHaveBeenCalledOnce();
  expect(redirect).not.toHaveBeenCalled();
});
