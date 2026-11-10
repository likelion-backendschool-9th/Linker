import type { ReactNode } from 'react';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import {
  BoardLoadingActions,
  BoardPageSkeleton,
} from '../../../../(developer)/teams/[id]/board/_components/board-page-skeleton/BoardPageSkeleton';
import {
  CalendarLoadingActions,
  CalendarPageSkeleton,
} from '../../../../(developer)/teams/[id]/calendar/_components/calendar-page-skeleton/CalendarPageSkeleton';
import {
  IssueDetailLoadingActions,
  IssueDetailPageSkeleton,
} from '../../../../(developer)/teams/[id]/issues/[issueId]/_components/issue-detail-page-skeleton/IssueDetailPageSkeleton';
import {
  IssueListLoadingActions,
  IssueListPageSkeleton,
} from '../../../../(developer)/teams/[id]/issues/_components/issue-list-page-skeleton/IssueListPageSkeleton';
import {
  TeamSettingsLoadingActions,
  TeamSettingsPageSkeleton,
} from '../../../../(developer)/teams/[id]/settings/_components/team-settings-page-skeleton/TeamSettingsPageSkeleton';
import { WorkspacePageSkeleton } from '../../../../(developer)/workspace/_components/workspace-page-skeleton/WorkspacePageSkeleton';
import { PostWritePageSkeleton } from '../../../../(developer)/posts/_components/post-editor/post-write-page-skeleton/PostWritePageSkeleton';
import { ChatListPageSkeleton } from '../../../../(member)/chats/_components/chat-list-page-skeleton/ChatListPageSkeleton';
import { NotificationListPageSkeleton } from '../../../../(member)/notifications/_components/notification-list-page-skeleton/NotificationListPageSkeleton';
import { SettingsPageSkeleton } from '../../../../(member)/settings/_components/settings-page-skeleton/SettingsPageSkeleton';
import { SubscriptionPageSkeleton } from '../../../../(member)/settings/subscription/_components/subscription-page-skeleton/SubscriptionPageSkeleton';
import { FeedListPageSkeleton } from '../../../feed/_components/feed-list-page-skeleton/FeedListPageSkeleton';
import {
  PostDetailLoadingActions,
  PostDetailPageSkeleton,
} from '../../../posts/[id]/_components/post-detail-page-skeleton/PostDetailPageSkeleton';
import { RecruitDetailPageSkeleton } from '../../../recruits/[id]/_components/recruit-detail-page-skeleton/RecruitDetailPageSkeleton';
import { RecruitListPageSkeleton } from '../../../recruits/_components/recruit-list-page-skeleton/RecruitListPageSkeleton';
import { ProfilePageSkeleton } from '../../../user/[login]/_components/profile-page-skeleton/ProfilePageSkeleton';

const PREVIEW_TEAM_ID = 'preview';

export type SkeletonEntry = {
  page: string;
  name: string;
  path: string;
  render: () => ReactNode;
};

/** Page-number → loading skeleton preview (matches each route's `loading.tsx`). */
export const SKELETON_ENTRIES: readonly SkeletonEntry[] = [
  {
    page: '4',
    name: '프로필',
    path: '/user/[login]',
    render: () => (
      <PageFrame title="내 프로필" variant="stack" backHref="/feed" bottomTabs>
        <ProfilePageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '6',
    name: '설정',
    path: '/settings',
    render: () => (
      <PageFrame title="설정" variant="stack" backHref="/feed">
        <SettingsPageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '7',
    name: '워크스페이스',
    path: '/workspace',
    render: () => (
      <PageFrame title="워크스페이스" hideTitle>
        <WorkspacePageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '9',
    name: '팀 설정',
    path: '/teams/[id]/settings',
    render: () => (
      <PageFrame
        title="팀 설정"
        variant="stack"
        backHref="/workspace"
        actions={<TeamSettingsLoadingActions />}
      >
        <TeamSettingsPageSkeleton teamId={PREVIEW_TEAM_ID} />
      </PageFrame>
    ),
  },
  {
    page: '11',
    name: '이슈 목록',
    path: '/teams/[id]/issues',
    render: () => (
      <PageFrame
        title="이슈"
        variant="stack"
        backHref="/workspace"
        actions={<IssueListLoadingActions />}
      >
        <IssueListPageSkeleton teamId={PREVIEW_TEAM_ID} />
      </PageFrame>
    ),
  },
  {
    page: '12',
    name: '이슈 상세',
    path: '/teams/[id]/issues/[issueId]',
    render: () => (
      <PageFrame
        title="이슈 상세"
        variant="stack"
        backHref="/workspace"
        actions={<IssueDetailLoadingActions />}
      >
        <IssueDetailPageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '14',
    name: '상태 보드',
    path: '/teams/[id]/board',
    render: () => (
      <PageFrame
        title="상태 보드"
        variant="stack"
        backHref="/workspace"
        actions={<BoardLoadingActions />}
      >
        <BoardPageSkeleton teamId={PREVIEW_TEAM_ID} />
      </PageFrame>
    ),
  },
  {
    page: '15',
    name: '캘린더',
    path: '/teams/[id]/calendar',
    render: () => (
      <PageFrame
        title="캘린더"
        variant="stack"
        backHref="/workspace"
        actions={<CalendarLoadingActions />}
      >
        <CalendarPageSkeleton teamId={PREVIEW_TEAM_ID} />
      </PageFrame>
    ),
  },
  {
    page: '16',
    name: '채팅 목록',
    path: '/chats',
    render: () => (
      <PageFrame title="채팅" hideTitle>
        <ChatListPageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '18',
    name: '알림',
    path: '/notifications',
    render: () => (
      <PageFrame title="알림" variant="stack" backHref="/feed">
        <NotificationListPageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '19',
    name: '모집글 목록',
    path: '/recruits',
    render: () => (
      <PageFrame title="팀 찾기" hideTitle>
        <RecruitListPageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '21',
    name: '모집 글 상세',
    path: '/recruits/[id]',
    render: () => (
      <PageFrame title="모집 글 상세" variant="stack" backHref="/recruits">
        <RecruitDetailPageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '22',
    name: '피드 작성',
    path: '/posts/new',
    render: () => (
      <PageFrame title="피드 작성" variant="stack" backHref="/feed">
        <PostWritePageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '23',
    name: '게시글 상세',
    path: '/posts/[id]',
    render: () => (
      <PageFrame
        title="게시글 상세"
        variant="stack"
        backHref="/feed"
        actions={<PostDetailLoadingActions />}
      >
        <PostDetailPageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '24',
    name: '홈 피드',
    path: '/feed',
    render: () => (
      <PageFrame title="홈" hideTitle>
        <FeedListPageSkeleton />
      </PageFrame>
    ),
  },
  {
    page: '29',
    name: '구독 관리',
    path: '/settings/subscription',
    render: () => (
      <PageFrame title="구독 관리" variant="stack" backHref="/settings">
        <SubscriptionPageSkeleton />
      </PageFrame>
    ),
  },
];

export const SKELETON_BY_PAGE = Object.fromEntries(
  SKELETON_ENTRIES.map((entry) => [entry.page, entry]),
) as Record<string, SkeletonEntry>;
