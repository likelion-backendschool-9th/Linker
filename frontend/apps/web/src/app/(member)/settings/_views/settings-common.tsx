'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import type { SettingsData, WithdrawalCheck } from '../_lib/settings-types';
import styles from './settings-view.module.css';

const emailSchema = z.object({ email: z.string().trim().email('올바른 이메일 주소를 입력해 주세요.') });
type EmailValues = z.infer<typeof emailSchema>;

export function SettingsCommon({
  login,
  settings,
  children,
}: {
  login: string;
  settings: SettingsData;
  children: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoutOverlay = useOverlay('profile-actions');
  const withdrawalSheet = useOverlay('profile-people');
  const withdrawalConfirm = useOverlay('delete-confirm');
  const blocksOverlay = useOverlay('settings-blocks');
  const [ownedTeams, setOwnedTeams] = useState<WithdrawalCheck['ownedTeams']>([]);
  const [pushEnabled, setPushEnabled] = useState(settings.pushEnabled);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
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

  const logout = useMutation({
    mutationFn: () => apiFetch<void>('/api/v1/user/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
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
    mutationFn: () => apiFetch<{ deletesOn: string }>('/api/v1/user/me/withdrawal', { method: 'POST' }),
    onSuccess: async (result) => {
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account-blocks'] }),
    onError: (error) => toast(errorMessage(error, '차단을 해제하지 못했어요.'), { tone: 'alert' }),
  });

  return (
    <div className={styles.content}>
      <section className={styles.section} aria-labelledby="account-heading">
        <h2 id="account-heading">계정</h2>
        <div className={styles.row}>
          <div className={styles.rowInfo}><span className={styles.label}>링커 아이디</span><span className={styles.value}>@{login}</span></div>
        </div>
        <form className={styles.form} onSubmit={form.handleSubmit((values) => emailSave.mutate(values))}>
          <div className={styles.field}>
            <label htmlFor="notification-email">알림 이메일</label>
            <input id="notification-email" type="email" autoComplete="email" {...form.register('email')} aria-invalid={Boolean(form.formState.errors.email)} aria-describedby={form.formState.errors.email ? 'email-error' : undefined} />
            {form.formState.errors.email && <span id="email-error" className={styles.error}>{form.formState.errors.email.message}</span>}
          </div>
          {form.formState.errors.root && <p className={styles.error} role="alert">{form.formState.errors.root.message}</p>}
          <Button
            type="submit"
            variant="outline"
            disabled={emailSave.isPending || !form.formState.isDirty}
            pending={emailSave.isPending}
            pendingLabel="저장 중…"
          >알림 이메일 저장</Button>
        </form>
      </section>

      <section className={styles.section} aria-labelledby="notification-heading">
        <h2 id="notification-heading">알림</h2>
        <div className={styles.row}>
          <div className={styles.rowInfo}><span className={styles.label}>푸시 알림</span><span className={styles.description}>끄면 푸시만 중단되고 앱 내 알림은 계속 쌓여요. 푸시는 Android 앱에서만 받을 수 있어요.</span></div>
          <button type="button" className={styles.toggle} aria-label={`푸시 알림 ${pushEnabled ? '켜짐' : '꺼짐'}`} aria-pressed={pushEnabled} aria-busy={pushSave.isPending} disabled={pushSave.isPending} onClick={() => pushSave.mutate(!pushEnabled)}>{pushSave.isPending ? <LoadingIndicator
            label="푸시 알림 저장 중…"
            labelHidden
            announce={false}
            tone={pushEnabled ? 'inverse' : 'inherit'}
          /> : pushEnabled ? '켜짐' : '꺼짐'}</button>
        </div>
      </section>

      {children}

      <section className={styles.section} aria-labelledby="info-heading">
        <h2 id="info-heading">도움말 및 정보</h2>
        <nav className={styles.links} aria-label="약관 및 정책">
          <Link className={styles.link} href="/legal/terms">이용약관</Link>
          <Link className={styles.link} href="/legal/privacy">개인정보 처리방침</Link>
          <Link className={styles.link} href="/legal/community">커뮤니티 정책</Link>
          <a className={styles.link} href="mailto:support@linker.example">문의하기</a>
        </nav>
      </section>

      <section className={styles.section} aria-labelledby="blocked-heading">
        <h2 id="blocked-heading">차단 관리</h2>
        <p className={styles.description}>차단한 사용자를 확인하고 차단을 해제할 수 있어요.</p>
        <Button variant="outline" onClick={() => blocksOverlay.open()}>차단한 사용자 보기</Button>
      </section>

      <section className={styles.section} aria-labelledby="account-action-heading">
        <h2 id="account-action-heading">계정 관리</h2>
        <Button variant="outline" onClick={() => logoutOverlay.open()}>로그아웃</Button>
        <Button
          variant="danger"
          onClick={() => withdrawalCheck.mutate()}
          disabled={withdrawalCheck.isPending}
          pending={withdrawalCheck.isPending}
          pendingLabel="확인 중…"
        >계정 탈퇴</Button>
      </section>

      <ConfirmDialog
        overlay={logoutOverlay}
        title="로그아웃할까요?"
        description="다시 이용하려면 로그인해야 해요."
        confirmLabel={logout.isPending ? '로그아웃 중…' : '로그아웃'}
        pending={logout.isPending}
        onConfirm={() => logout.mutate()}
      />
      <OverlaySheet overlay={blocksOverlay} title="차단한 사용자" description="차단을 해제할 사용자를 선택해 주세요.">
        {blocks.isPending ? <p role="status"><LoadingIndicator label="차단 목록을 불러오는 중…" announce={false} /></p> : blocks.isError ? <div><p role="alert">차단 목록을 불러오지 못했어요.</p><Button variant="outline" onClick={() => void blocks.refetch()}>다시 시도</Button></div> : blocks.data?.length ? (
          <ul className={styles.blockList}>{blocks.data.map(({ user }) => <li className={styles.blockItem} key={user.id}><span>{user.name} · @{user.login}</span><Button
            variant="outline"
            disabled={unblock.isPending}
            onClick={() => unblock.mutate(user.id)}
            pending={unblock.isPending && unblock.variables === user.id}
          >차단 해제</Button></li>)}</ul>
        ) : <p>차단한 사용자가 없어요.</p>}
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
    <section className={styles.section} aria-labelledby="plan-heading">
      <h2 id="plan-heading">요금제 및 구독</h2>
      <div className={styles.row}>
        <div className={styles.rowInfo}><span className={styles.label}>{settings.plan.label}</span><span className={styles.description}>{settings.plan.renewsOn ? `다음 결제일 ${settings.plan.renewsOn}` : settings.plan.kind === 'SCOUT' ? '채용 담당자용 Scout 요금제' : '이용 중인 요금제'}</span></div>
        <span className={styles.description}>구독 관리 화면은 준비 중이에요.</span>
      </div>
    </section>
  );
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
