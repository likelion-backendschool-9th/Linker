'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { clearNativeSession, unregisterNativePushToken } from '@/features/auth/sync-native-session';
import { chatKeys } from '@/features/chat/chat-queries';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { isInApp, requestNative } from '@/lib/bridge/native';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { disconnect } from '@/lib/realtime/stomp-client';
import { toast } from '@/stores/toast-store';

import type { SettingsData, WithdrawalCheck } from '../_lib/settings-types';
import styles from './settings-view.module.css';

const emailSchema = z.object({ email: z.string().trim().email('올바른 이메일 주소를 입력해 주세요.') });
type EmailValues = z.infer<typeof emailSchema>;

export function SettingsCommon({
  login,
  settings,
  accountStart,
  personal,
  blockCount,
  children,
}: {
  login: string;
  settings: SettingsData;
  accountStart?: ReactNode;
  personal?: ReactNode;
  blockCount?: number;
  children?: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoutOverlay = useOverlay('profile-actions');
  const withdrawalSheet = useOverlay('profile-people');
  const withdrawalConfirm = useOverlay('delete-confirm');
  const blocksOverlay = useOverlay('settings-blocks');
  const [ownedTeams, setOwnedTeams] = useState<WithdrawalCheck['ownedTeams']>([]);
  const [pushEnabled, setPushEnabled] = useState(settings.pushEnabled);
  const [requestingPush, setRequestingPush] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [blockQuery, setBlockQuery] = useState('');
  const form = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: settings.notificationEmail },
  });

  const emailSave = useMutation({
    mutationFn: (values: EmailValues) =>
      apiFetch<{ email?: string; notificationEmail?: string }>('/api/v1/user/me/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email.trim() }),
      }),
    onSuccess: (saved, values) => {
      form.reset({ email: saved.notificationEmail ?? saved.email ?? values.email.trim() });
      toast('알림 이메일을 저장했어요.');
      router.refresh();
    },
    onError: (error) => form.setError('root', { message: errorMessage(error, '알림 이메일을 저장하지 못했어요.') }),
  });

  const pushSave = useMutation({
    mutationFn: (pushEnabled: boolean) =>
      apiFetch<{ pushEnabled: boolean }>('/api/v1/user/me/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushEnabled }),
      }),
    onSuccess: (saved) => {
      setPushEnabled(saved.pushEnabled);
      toast('푸시 알림 설정을 저장했어요.');
      router.refresh();
    },
    onError: (error) => toast(errorMessage(error, '푸시 알림 설정을 저장하지 못했어요.'), { tone: 'alert' }),
  });

  async function togglePush() {
    if (requestingPush || pushSave.isPending) return;
    setRequestingPush(true);
    try {
      const next = !pushEnabled;
      if (next && isInApp()) {
        try {
          const result = await requestNative({ type: 'PUSH_PERMISSION_REQUEST' }, { timeoutMs: 0 });
          const status =
            result.ok && result.payload && typeof result.payload === 'object'
              ? (result.payload as { status?: string }).status
              : undefined;
          if (status === 'denied') {
            toast('푸시 권한을 허용해야 Android 알림을 받을 수 있어요.', {
              tone: 'alert',
            });
            return;
          }
        } catch {
          // Preference can still be saved; the token may arrive on a later grant.
        }
      } else if (next && !isInApp()) {
        toast('푸시는 Android 앱에서만 받을 수 있어요.');
      }
      await pushSave.mutateAsync(next);
    } catch {
      // pushSave.onError displays the existing settings error.
    } finally {
      setRequestingPush(false);
    }
  }

  const logout = useMutation({
    mutationFn: async () => {
      await unregisterNativePushToken();
      await apiFetch<void>('/api/v1/user/auth/logout', { method: 'POST' });
    },
    onSuccess: async () => {
      clearNativeSession();
      await disconnect();
      await queryClient.clear();
      logoutOverlay.close();
      router.replace('/');
      router.refresh();
    },
    onError: (error) => toast(errorMessage(error, '로그아웃하지 못했어요. 다시 시도해 주세요.'), { tone: 'alert' }),
  });

  const withdrawalCheck = useMutation({
    mutationFn: () => apiFetch<WithdrawalCheck>('/api/v1/user/me/withdrawal-check'),
    onSuccess: (result) => {
      setOwnedTeams(result.ownedTeams);
      setWithdrawalError(null);
      withdrawalSheet.open();
    },
    onError: (error) => toast(errorMessage(error, '탈퇴 가능 여부를 확인하지 못했어요.'), { tone: 'alert' }),
  });

  const withdrawal = useMutation({
    mutationFn: async () => {
      await unregisterNativePushToken();
      return apiFetch<{ deletesOn: string }>('/api/v1/user/me/withdrawal', { method: 'POST' });
    },
    onSuccess: async (result) => {
      clearNativeSession();
      await disconnect();
      await queryClient.clear();
      withdrawalConfirm.close();
      withdrawalSheet.close();
      toast(`${result.deletesOn}에 계정이 삭제될 예정이에요. 그전까지 다시 로그인하면 복구할 수 있어요.`);
      router.replace('/');
      router.refresh();
    },
    onError: (error) => setWithdrawalError(errorMessage(error, '계정 탈퇴를 완료하지 못했어요.')),
  });

  const blocks = useQuery({
    queryKey: ['account-blocks'],
    queryFn: () => apiFetch<{ user: { id: number; login: string; name: string }; blockedAt: string }[]>('/api/v1/user/me/blocks'),
    enabled: blocksOverlay.isOpen,
  });
  const unblock = useMutation({
    mutationFn: (userId: number) => apiFetch<void>(`/api/v1/user/blocks/${userId}`, { method: 'DELETE' }),
    // Unblocking brings the 1:1 room back to the always-mounted chat badge and list.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['account-blocks'] }),
        queryClient.invalidateQueries({ queryKey: chatKeys.all }),
      ]),
    onError: (error) => toast(errorMessage(error, '차단을 해제하지 못했어요.'), { tone: 'alert' }),
  });

  const blockRows = Array.isArray(blocks.data) ? blocks.data : [];
  const visibleBlocks = blockRows.filter(({ user }) => {
    const query = blockQuery.trim().toLowerCase();
    return query.length === 0 || user.name.toLowerCase().includes(query) || user.login.toLowerCase().includes(query);
  });

  return (
    <div className={styles.content}>
      <section className={styles.group} aria-labelledby="account-heading">
        <h2 id="account-heading" className={styles.groupTitle}>계정 및 연결</h2>
        <div className={styles.card}>
          {accountStart}
          <form className={styles.emailRow} onSubmit={form.handleSubmit((values) => emailSave.mutate(values))}>
            <label htmlFor="notification-email">알림 이메일</label>
            <input id="notification-email" type="email" autoComplete="email" {...form.register('email')} aria-invalid={Boolean(form.formState.errors.email)} aria-describedby={form.formState.errors.email ? 'email-error' : undefined} />
            <button type="submit" className={styles.save} disabled={emailSave.isPending || !form.formState.isDirty}>{emailSave.isPending ? '저장 중…' : '알림 이메일 저장'}</button>
          </form>
          {form.formState.errors.email && <span id="email-error" className={styles.error}>{form.formState.errors.email.message}</span>}
          {form.formState.errors.root && <p className={styles.error} role="alert">{form.formState.errors.root.message}</p>}
          <AccountPlan settings={settings} />
          <div className={styles.row}>
            <span>푸시 알림</span>
            <button type="button" className={styles.toggle} aria-label={`푸시 알림 ${pushEnabled ? '켜짐' : '꺼짐'}`} aria-pressed={pushEnabled} disabled={requestingPush || pushSave.isPending} aria-busy={requestingPush || pushSave.isPending} onClick={() => void togglePush()}><span className={styles.knob} /></button>
          </div>
          <p className={styles.note}>끄면 푸시만 중단되고 앱 내 알림은 계속 쌓여요. 푸시는 Android 앱에서만 받아요.</p>
          <button type="button" className={styles.row} onClick={() => logoutOverlay.open()}>
            <span>로그아웃</span><span className={styles.chevron} aria-hidden="true" />
          </button>
          <button type="button" className={styles.row} onClick={() => withdrawalCheck.mutate()} disabled={withdrawalCheck.isPending}>
            <span>{withdrawalCheck.isPending ? '확인 중…' : '계정 탈퇴'}</span><span className={styles.chevron} aria-hidden="true" />
          </button>
        </div>
      </section>

      {children}

      <section className={styles.group} aria-labelledby="personal-heading">
        <h2 id="personal-heading" className={styles.groupTitle}>개인 정보</h2>
        <div className={styles.card}>
          {personal}
          <button type="button" className={styles.row} onClick={() => blocksOverlay.open()}>
            <span>차단한 사용자 보기</span>
            <span className={styles.trailing}><span className={styles.value}>{`${blocks.isSuccess && Array.isArray(blocks.data) ? blocks.data.length : (blockCount ?? 0)}명`}</span><span className={styles.chevron} aria-hidden="true" /></span>
          </button>
        </div>
      </section>

      <section className={styles.group} aria-labelledby="info-heading">
        <h2 id="info-heading" className={styles.groupTitle}>기타</h2>
        <nav className={styles.card} aria-label="약관 및 정책">
          <Link className={styles.row} href="/legal/terms"><span>이용약관</span><span className={styles.chevron} aria-hidden="true" /></Link>
          <Link className={styles.row} href="/legal/privacy"><span>개인정보 처리방침</span><span className={styles.chevron} aria-hidden="true" /></Link>
          <Link className={styles.row} href="/legal/community"><span>커뮤니티 정책</span><span className={styles.chevron} aria-hidden="true" /></Link>
          <a className={styles.row} href="mailto:support@linker.example"><span>문의하기</span><span className={styles.chevron} aria-hidden="true" /></a>
          <div className={styles.row}><span>링커 아이디</span><span className={styles.value}>@{login}</span></div>
        </nav>
      </section>

      <ConfirmDialog
        overlay={logoutOverlay}
        title="로그아웃"
        description="로그아웃을 하시면 서비스 이용에 제약이 생깁니다. 로그아웃 하시겠습니까?"
        confirmLabel={logout.isPending ? '로그아웃 중…' : '로그아웃'}
        pending={logout.isPending}
        onConfirm={() => logout.mutate()}
      />
      <OverlaySheet overlay={blocksOverlay} title="차단한 사용자">
        <label className={styles.searchLabel} htmlFor="block-search">이름 또는 아이디 검색</label>
        <input id="block-search" className={styles.search} value={blockQuery} onChange={(event) => setBlockQuery(event.target.value)} placeholder="이름 또는 아이디 검색" />
        {blocks.isPending ? <p role="status">차단 목록을 불러오는 중…</p> : blocks.isError ? <div><p role="alert">차단 목록을 불러오지 못했어요.</p><Button variant="outline" onClick={() => void blocks.refetch()}>다시 시도</Button></div> : visibleBlocks.length ? (
          <ul className={styles.blockList}>{visibleBlocks.map(({ user }) => <li className={styles.blockItem} key={user.id}><span className={styles.person}><span>{user.name}</span><span className={styles.value}>@{user.login}</span></span><button type="button" className={styles.unblock} aria-label={`${user.name} 차단 해제`} disabled={unblock.isPending} onClick={() => unblock.mutate(user.id)}>-</button></li>)}</ul>
        ) : <p>{blockRows.length ? '검색 결과가 없어요.' : '차단한 사용자가 없어요.'}</p>}
      </OverlaySheet>
      <OverlaySheet overlay={withdrawalSheet} title="계정 탈퇴 안내" description="탈퇴 전에 소유한 팀을 확인해 주세요.">
        <p>탈퇴하면 바로 서비스 이용이 중단되고, 30일 후 계정이 삭제돼요. 삭제 전 다시 로그인하면 계정을 복구할 수 있어요.</p>
        {ownedTeams.length > 0 ? <>
          <p>아래 팀의 소유권을 이전하거나 팀을 삭제한 뒤 탈퇴할 수 있어요.</p>
          <ul className={styles.teamList}>{ownedTeams.map((team) => <li key={team.id}>{team.name}</li>)}</ul>
        </> : <p>소유한 팀이 없어 탈퇴를 진행할 수 있어요.</p>}
        {withdrawalError && <p className={styles.error} role="alert">{withdrawalError}</p>}
        <div className={styles.form}>
          {ownedTeams.length === 0 && <Button variant="danger" onClick={() => withdrawalConfirm.open()}>탈퇴 계속하기</Button>}
          <Button variant="outline" onClick={() => withdrawalSheet.close()}>닫기</Button>
        </div>
      </OverlaySheet>
      <ConfirmDialog
        overlay={withdrawalConfirm}
        title="정말 탈퇴할까요?"
        description="게시물과 댓글은 삭제되고, 팀 채팅에는 탈퇴한 사용자로 표시돼요. 30일 뒤 삭제되며 그전에 로그인하면 복구할 수 있어요."
        confirmLabel={withdrawal.isPending ? '처리 중…' : '계정 탈퇴'}
        destructive
        pending={withdrawal.isPending}
        onConfirm={() => withdrawal.mutate()}
      />
    </div>
  );
}

export function AccountPlan({ settings }: { settings: SettingsData }) {
  return (
    <Link className={styles.row} href="/settings/subscription" aria-label="구독 관리">
      <span>구독과 결제</span>
      <span className={styles.trailing}><span className={styles.value}>{settings.plan.label}</span><span className={styles.chevron} aria-hidden="true" /></span>
    </Link>
  );
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
