'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { startGithubLogin } from '@/features/auth/start-github-login';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { toast } from '@/stores/toast-store';

import type { Invite } from '../../_lib/get-invite';
import { acceptInvite } from './api';

const RECRUITER_BLOCK = '개발자 계정만 팀에 참여할 수 있어요';

function inviteReturnTo(code: string) {
  return `/invite/${encodeURIComponent(code)}`;
}

function issuesHref(teamId: number): Route {
  return `/teams/${teamId}/issues` as Route;
}

function invalidMessage(status: Invite['status']) {
  return status === 'EXPIRED'
    ? '초대 링크의 유효 기간이 지났어요.'
    : '더 이상 쓸 수 없는 초대 링크예요.';
}

export function useInviteAcceptArea(invite: Invite) {
  const viewer = useViewer();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const redirected = useRef(false);
  const returnTo = inviteReturnTo(invite.code);

  useEffect(() => {
    if (redirected.current) return;
    if (viewer.role !== 'developer' && viewer.role !== 'operator') return;
    if (
      invite.participation.state !== 'ALREADY_MEMBER' &&
      invite.participation.state !== 'ACCEPTED'
    )
      return;
    if (!invite.team.id) return;
    redirected.current = true;
    router.replace(issuesHref(invite.team.id));
  }, [invite.participation.state, invite.team.id, router, viewer.role]);

  async function startGithub() {
    setPending(true);
    try {
      await startGithubLogin(returnTo);
    } catch {
      toast('GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'error' });
    } finally {
      setPending(false);
    }
  }

  async function onJoin() {
    if (pending) return;
    if (viewer.role === 'recruiter') {
      toast(RECRUITER_BLOCK, { tone: 'error' });
      return;
    }
    if (invite.status !== 'VALID') {
      toast(invalidMessage(invite.status), { tone: 'error' });
      return;
    }
    if (viewer.role === 'guest') {
      await startGithub();
      return;
    }
    if (viewer.status === 'SUSPENDED') {
      toast('이용이 제한된 동안에는 팀에 참여할 수 없어요.', { tone: 'error' });
      return;
    }
    setPending(true);
    try {
      const result = await acceptInvite(invite.code);
      router.replace(issuesHref(result.teamId));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_MEMBER') {
        router.replace(issuesHref(invite.team.id));
        return;
      }
      toast(
        error instanceof ApiError && error.message
          ? error.message
          : '팀에 합류하지 못했어요. 잠시 후 다시 시도해 주세요.',
        { tone: 'error' },
      );
    } finally {
      setPending(false);
    }
  }

  async function onGithubSignup() {
    if (pending) return;
    if (viewer.role === 'recruiter') {
      toast(RECRUITER_BLOCK, { tone: 'error' });
      return;
    }
    if (invite.status !== 'VALID') {
      toast(invalidMessage(invite.status), { tone: 'error' });
      return;
    }
    await startGithub();
  }

  return { pending, onJoin, onGithubSignup };
}
