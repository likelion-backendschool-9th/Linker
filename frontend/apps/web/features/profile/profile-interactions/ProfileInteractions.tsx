'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { BlockConfirmDialog } from '@/features/block/block-confirm-dialog/BlockConfirmDialog';
import { useRequireLogin } from '@/features/auth/use-require-login';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { reportTargetId } from '@/features/report/report-target';
import { profileHref } from '@/lib/navigation/collaboration-links';
import { useOverlay } from '@/lib/navigation/use-overlay';
import type { Role } from '@/lib/auth/route-access';
import type { ProfilePeopleResponse, PublicProfile } from '../profile-types';
import { profileQueryKey } from '../profile-types';

import styles from './ProfileInteractions.module.css';

export type ProfileInteractionApi = {
  openPeople: (type: 'followers' | 'followings') => void;
  showFollow: boolean;
  following: boolean;
  followPending: boolean;
  toggleFollow: () => void;
  showMore: boolean;
  openMore: () => void;
  actionError: string | null;
};

export function ProfileInteractions({
  profile,
  viewerRole,
  children,
}: {
  profile: PublicProfile;
  viewerRole: Role;
  /** Developer profile supplies its own layout and reuses these actions. */
  children?: (api: ProfileInteractionApi) => ReactNode;
}) {
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  const people = useOverlay('profile-people');
  const actions = useOverlay('profile-actions');
  const report = useOverlay('report');
  const block = useOverlay('block');
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const isDeveloper = profile.kind === 'DEVELOPER';

  const follow = useMutation({
    mutationFn: (nextFollowing: boolean) =>
      apiFetch<void>(`/api/v1/user/user/${encodeURIComponent(profile.login)}/follow`, {
        method: nextFollowing ? 'POST' : 'DELETE',
      }),
    onMutate: async (nextFollowing) => {
      const key = profileQueryKey(profile.login);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PublicProfile>(key) ?? profile;
      queryClient.setQueryData<PublicProfile>(key, {
        ...previous,
        isFollowing: nextFollowing,
        followerCount: Math.max(0, previous.followerCount + (nextFollowing ? 1 : -1)),
      });
      setActionError(null);
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous)
        queryClient.setQueryData(profileQueryKey(profile.login), context.previous);
      setActionError(error instanceof ApiError ? error.message : '팔로우 상태를 바꾸지 못했어요.');
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: profileQueryKey(profile.login) }),
  });

  function openPeople(type: 'followers' | 'followings') {
    if (!requireLogin()) return;
    people.open(type);
  }

  const showDeveloperFollow = isDeveloper && !profile.isMe && viewerRole !== 'recruiter';
  const showMore = !profile.isMe;

  function toggleFollow() {
    if (!requireLogin()) return;
    follow.mutate(!profile.isFollowing);
  }

  const sheets = (
    <>
      <ProfilePeopleSheet login={profile.login} profile={profile} overlay={people} />
      <OverlaySheet
        overlay={actions}
        title="프로필 관리"
        description="프로필에 관한 작업을 선택해 주세요."
      >
        <div className={styles.sheetActions}>
          <Button
            block
            variant="outline"
            onClick={() => report.open(reportTargetId('USER', profile.id))}
          >
            신고하기
          </Button>
          <Button block variant="danger" onClick={() => block.open(String(profile.id))}>
            차단하기
          </Button>
        </div>
      </OverlaySheet>
      {showMore && (
        <BlockConfirmDialog
          userId={profile.id}
          name={profile.name}
          onBlocked={() => router.refresh()}
        />
      )}
    </>
  );

  if (children) {
    return (
      <>
        {children({
          openPeople,
          showFollow: showDeveloperFollow,
          following: profile.isFollowing,
          followPending: follow.isPending,
          toggleFollow,
          showMore,
          openMore: () => {
            if (requireLogin()) actions.open();
          },
          actionError,
        })}
        {sheets}
      </>
    );
  }

  return (
    <>
      <div className={styles.root}>
        {isDeveloper && (
          <div className={styles.counts} aria-label="팔로우 현황">
            <button type="button" onClick={() => openPeople('followers')}>
              <strong>{profile.followerCount}</strong> 팔로워
            </button>
            <button type="button" onClick={() => openPeople('followings')}>
              <strong>{profile.followingCount}</strong> 팔로잉
            </button>
          </div>
        )}
        {profile.isMe ? (
          <div className={styles.buttons}>
            <Button asChild variant="outline">
              <Link href="/settings/profile">프로필 편집</Link>
            </Button>
          </div>
        ) : (
          <div className={styles.buttons}>
            {showDeveloperFollow && (
              <Button
                variant={profile.isFollowing ? 'outline' : 'primary'}
                aria-pressed={profile.isFollowing}
                aria-busy={follow.isPending}
                onClick={toggleFollow}
              >
                {profile.isFollowing ? '팔로잉' : '팔로우'}
              </Button>
            )}
            {showMore && (
              <Button variant="outline" onClick={() => { if (requireLogin()) actions.open(); }}>
                더 보기
              </Button>
            )}
          </div>
        )}
        {actionError && (
          <p className={styles.error} role="alert">
            {actionError}
          </p>
        )}
      </div>

      {sheets}
    </>
  );
}

function ProfilePeopleSheet({
  login,
  profile,
  overlay,
}: {
  login: string;
  profile: PublicProfile;
  overlay: ReturnType<typeof useOverlay>;
}) {
  const type = overlay.id === 'followings' ? 'followings' : 'followers';
  const [query, setQuery] = useState('');
  const people = useQuery({
    queryKey: ['profile-people', login, type],
    queryFn: () =>
      apiFetch<ProfilePeopleResponse>(`/api/v1/user/user/${encodeURIComponent(login)}/${type}`),
    enabled: overlay.isOpen,
  });

  const items = (people.data?.items ?? []).filter(({ user }) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return user.name.toLowerCase().includes(keyword) || user.login.toLowerCase().includes(keyword);
  });
  return (
    <OverlaySheet
      overlay={overlay}
      title="팔로우"
      description={`${profile.name}님의 팔로우와 팔로잉 목록`}
      describeHidden
      closeIcon={<ArrowLeft aria-hidden />}
      closeLabel="뒤로"
      classNames={{
        sheet: styles.peopleSheet,
        header: styles.peopleHeader,
        title: styles.peopleTitle,
        close: styles.peopleBack,
        body: styles.peopleBody,
      }}
    >
      <div className={styles.peopleTabs} role="tablist" aria-label="팔로우 목록">
        <button
          type="button"
          role="tab"
          aria-selected={type === 'followers'}
          aria-controls="profile-people-panel"
          id="profile-followers-tab"
          onClick={() => overlay.open('followers')}
        >
          팔로우
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={type === 'followings'}
          aria-controls="profile-people-panel"
          id="profile-followings-tab"
          onClick={() => overlay.open('followings')}
        >
          팔로잉
        </button>
      </div>
      <label className={styles.search}>
        <Search aria-hidden />
        <span className="sr-only">이름 또는 아이디 검색</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 또는 아이디 검색"
        />
      </label>
      <div
        id="profile-people-panel"
        role="tabpanel"
        aria-labelledby={type === 'followers' ? 'profile-followers-tab' : 'profile-followings-tab'}
      >
        {people.isPending ? (
          <p role="status">목록을 불러오고 있어요.</p>
        ) : people.isError ? (
          <p className={styles.error} role="alert">
            목록을 불러오지 못했어요. 다시 시도해 주세요.
          </p>
        ) : items.length === 0 ? (
          <p>아직 표시할 사용자가 없어요.</p>
        ) : (
          <ul className={styles.peopleList}>
            {items.map(({ user, isFollowing }) => (
              <li key={user.id}>
                <Link className={styles.person} href={profileHref(user.login)} onClick={overlay.close}>
                  <span className={styles.personAvatar}>
                    {user.avatarUrl && <Image src={user.avatarUrl} alt="" fill sizes="40px" />}
                  </span>
                  <span className={styles.personText}>
                    <span className={styles.personName}>{user.name}</span>
                    <span className={styles.personHandle}>@{user.login}</span>
                  </span>
                </Link>
                <span className={styles.relation}>{isFollowing ? '팔로잉' : '팔로우'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </OverlaySheet>
  );
}
