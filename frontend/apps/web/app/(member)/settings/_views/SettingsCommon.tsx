'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AlertDialog } from 'radix-ui';
import type { Route } from 'next';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { z } from 'zod';

import {
  getGetWithdrawalCheckQueryKey,
  getWithdrawalCheck,
  withdrawAccount,
} from '@linker/api/p06-settings/p06-settings';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { clearNativeSession, unregisterNativePushToken } from '@/features/auth/sync-native-session';
import { chatKeys } from '@/features/chat/chat-queries';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { disconnect } from '@/lib/realtime/stomp-client';
import { toast } from '@/stores/toast-store';

import type { SettingsData } from '../_lib/settings-types';
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
  const blocksOverlay = useOverlay('settings-blocks');
  const withdrawalCheck = useQuery({
    queryKey: [...getGetWithdrawalCheckQueryKey(), login],
    queryFn: ({ signal }) => getWithdrawalCheck({ signal }),
    enabled: withdrawalSheet.isOpen,
  });
  const ownedTeams = withdrawalCheck.data?.ownedTeams ?? [];
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [showOwnedTeamGuard, setShowOwnedTeamGuard] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState(settings.notificationEmail);
  const [blockQuery, setBlockQuery] = useState('');
  const logoutCancelRef = useRef<HTMLButtonElement>(null);
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
      const nextEmail = saved.notificationEmail ?? saved.email ?? values.email.trim();
      form.reset({ email: nextEmail });
      setNotificationEmail(nextEmail);
      setEditingEmail(false);
      toast('알림 이메일을 저장했어요.');
      router.refresh();
    },
    onError: (error) => form.setError('root', { message: errorMessage(error, '알림 이메일을 저장하지 못했어요.') }),
  });

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
    onError: (error) => toast(errorMessage(error, '로그아웃하지 못했어요. 다시 시도해 주세요.'), { tone: 'error' }),
  });

  const withdrawal = useMutation({
    mutationFn: async () => {
      await unregisterNativePushToken();
      return withdrawAccount();
    },
    onSuccess: async (result) => {
      clearNativeSession();
      await disconnect();
      await queryClient.clear();
      withdrawalSheet.close();
      toast(
        result.deletesOn
          ? `${result.deletesOn}에 계정이 삭제될 예정이에요. 그전까지 다시 로그인하면 복구할 수 있어요.`
          : '30일 후 계정이 삭제될 예정이에요. 그전까지 다시 로그인하면 복구할 수 있어요.',
      );
      router.replace('/');
      router.refresh();
    },
    onError: (error) => setWithdrawalError(errorMessage(error, '계정 탈퇴를 완료하지 못했어요.')),
  });

  const blocks = useQuery({
    queryKey: ['account-blocks'],
    queryFn: () =>
      apiFetch<{ user: { id: number; login: string; name: string; avatarUrl?: string }; blockedAt: string }[]>(
        '/api/v1/user/me/blocks',
      ),
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
    onError: (error) => toast(errorMessage(error, '차단을 해제하지 못했어요.'), { tone: 'error' }),
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
          {editingEmail ? (
            <form noValidate className={styles.emailRow} onSubmit={form.handleSubmit((values) => emailSave.mutate(values))}>
              <label htmlFor="notification-email">알림 이메일</label>
              <input id="notification-email" type="email" autoComplete="email" {...form.register('email')} aria-invalid={Boolean(form.formState.errors.email)} aria-describedby={form.formState.errors.email ? 'email-error' : undefined} />
              <button type="submit" className={styles.save} disabled={emailSave.isPending || !form.formState.isDirty}>{emailSave.isPending ? '저장 중…' : '저장'}</button>
            </form>
          ) : (
            <button type="button" className={`${styles.row} ${styles.emailDisplay}`} aria-label={`알림 이메일 ${notificationEmail}`} onClick={() => setEditingEmail(true)}>
              <span>알림 이메일</span>
              <span className={styles.emailValue}>{notificationEmail}</span>
            </button>
          )}
          {form.formState.errors.email && <span id="email-error" className={styles.error}>{form.formState.errors.email.message}</span>}
          {form.formState.errors.root && <p className={styles.error} role="alert">{form.formState.errors.root.message}</p>}
          <AccountPlan settings={settings} />
          <button type="button" className={styles.row} onClick={() => logoutOverlay.open()}>
            <span>로그아웃</span>
            <span className={styles.chevron} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.row}
            onClick={() => {
              setWithdrawalError(null);
              setShowOwnedTeamGuard(false);
              withdrawalSheet.open();
            }}
          >
            <span>계정 삭제</span>
            <span className={styles.chevron} aria-hidden="true" />
          </button>
        </div>
      </section>

      {children}

      <section className={styles.group} aria-labelledby="personal-heading">
        <h2 id="personal-heading" className={styles.groupTitle}>개인 정보</h2>
        <div className={styles.card}>
          {personal}
          <button type="button" className={styles.row} onClick={() => blocksOverlay.open()}>
            <span>차단 사용자</span>
            <span className={styles.trailing}><span className={styles.value}>{`${blocks.isSuccess && Array.isArray(blocks.data) ? blocks.data.length : (blockCount ?? 0)}명`}</span><span className={styles.chevron} aria-hidden="true" /></span>
          </button>
        </div>
      </section>

      <section className={styles.group} aria-labelledby="info-heading">
        <h2 id="info-heading" className={styles.groupTitle}>기타</h2>
        <nav className={styles.card} aria-label="약관 및 정책">
          <Link className={styles.row} href="/legal/terms"><span>이용약관</span><span className={styles.trailing}><span className={styles.value}>동의함</span><span className={styles.chevron} aria-hidden="true" /></span></Link>
          <Link className={styles.row} href="/legal/privacy"><span>개인정보 처리방침</span><span className={styles.trailing}><span className={styles.value}>동의함</span><span className={styles.chevron} aria-hidden="true" /></span></Link>
        </nav>
      </section>

      <AlertDialog.Root open={logoutOverlay.isOpen} onOpenChange={logoutOverlay.onOpenChange}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.logoutScrim} />
          <AlertDialog.Content
            className={styles.logoutDialog}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              logoutCancelRef.current?.focus();
            }}
          >
            <div className={styles.logoutHeader}>
              <AlertDialog.Title className={styles.logoutTitle}>로그아웃</AlertDialog.Title>
              <AlertDialog.Cancel className={styles.logoutClose}>
                <X aria-hidden="true" size={16} />
                <span className="sr-only">닫기</span>
              </AlertDialog.Cancel>
            </div>
            <AlertDialog.Description className={styles.logoutBody}>
              로그 아웃을 하시면 서비스 이용에 제약이 생깁니다. 로그아웃 하시겠습니까?
            </AlertDialog.Description>
            <div className={styles.logoutActions}>
              <button type="button" className={styles.logoutConfirm} disabled={logout.isPending} onClick={() => logout.mutate()}>
                {logout.isPending ? '로그아웃 중…' : '로그아웃'}
              </button>
              <AlertDialog.Cancel ref={logoutCancelRef} className={styles.logoutCancel}>취소 하기</AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <OverlaySheet
        overlay={blocksOverlay}
        title="차단한 사용자"
        description="차단을 해제할 사용자를 선택해 주세요."
        describeHidden
        closeIcon={<ArrowLeft aria-hidden size={24} />}
        closeLabel="뒤로가기"
        classNames={{ sheet: styles.blockSheet, header: styles.blockHeader, body: styles.blockBody, title: styles.blockTitle, close: styles.blockClose }}
      >
        <label className={styles.searchField}>
          <Search aria-hidden="true" size={24} />
          <span className={styles.searchLabel}>이름 또는 아이디 검색</span>
          <input id="block-search" value={blockQuery} onChange={(event) => setBlockQuery(event.target.value)} placeholder="이름 또는 아이디 검색" />
        </label>
        {blocks.isPending ? <p role="status">차단 목록을 불러오는 중…</p> : blocks.isError ? <div><p role="alert">차단 목록을 불러오지 못했어요.</p><Button variant="outline" onClick={() => void blocks.refetch()}>다시 시도</Button></div> : visibleBlocks.length ? (
          <ul className={styles.blockList}>{visibleBlocks.map(({ user }) => (
            <li className={styles.blockItem} key={user.id}>
              <span className={styles.person}>
                <span className={styles.avatar}>
                  {user.avatarUrl ? <Image src={user.avatarUrl} alt="" fill sizes="44px" /> : null}
                </span>
                <span className={styles.personText}>
                  <span className={styles.personName}>{user.name}</span>
                  <span className={styles.value}>@{user.login}</span>
                </span>
              </span>
              <button type="button" className={styles.unblock} aria-label={`${user.name} 차단 해제`} disabled={unblock.isPending} onClick={() => unblock.mutate(user.id)}>
                <span className={styles.unblockMark} aria-hidden="true" />
              </button>
            </li>
          ))}</ul>
        ) : <p className={blockRows.length ? undefined : styles.blockEmpty}>{blockRows.length ? '검색 결과가 없어요.' : '차단한 사용자가 없어요.'}</p>}
      </OverlaySheet>
      <AlertDialog.Root open={withdrawalSheet.isOpen} onOpenChange={withdrawalSheet.onOpenChange}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.logoutScrim} />
          <AlertDialog.Content className={styles.logoutDialog}>
            <div className={styles.logoutHeader}>
              <AlertDialog.Title className={styles.logoutTitle}>계정 삭제</AlertDialog.Title>
              <AlertDialog.Cancel className={styles.logoutClose}>
                <X aria-hidden="true" />
                <span className="sr-only">닫기</span>
              </AlertDialog.Cancel>
            </div>
            <AlertDialog.Description className={styles.logoutBody}>
              계정을 삭제하시면 기존에 있던 서비스를 사용하실 수 없습니다. 삭제 하시겠습니까?
            </AlertDialog.Description>
            {withdrawalError ? <p className={styles.error} role="alert">{withdrawalError}</p> : null}
            {showOwnedTeamGuard ? (
              <div className={styles.withdrawalDetails}>
                <p>아래 팀의 소유권을 이전하거나 팀을 삭제한 뒤 다시 시도해 주세요.</p>
                <ul className={styles.teamList}>
                  {ownedTeams.map((team) => {
                    const teamSettingsHref = `/teams/${team.id}/settings` as Route;
                    return (
                      <li key={team.id}>
                        <Link
                          className={styles.teamSettingsLink}
                          href={teamSettingsHref}
                          aria-label={`${team.name} 팀 설정`}
                          onClick={(event) => {
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                            event.preventDefault();
                            void withdrawalSheet.closeThen(teamSettingsHref);
                          }}
                        >
                          <span>{team.name}</span>
                          <span className={styles.chevron} aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <div className={styles.logoutActions}>
              <button
                type="button"
                className={styles.logoutConfirm}
                disabled={withdrawal.isPending || withdrawalCheck.isPending || withdrawalCheck.isFetching}
                onClick={() => {
                  setWithdrawalError(null);
                  if (withdrawalCheck.isError) {
                    setWithdrawalError(errorMessage(withdrawalCheck.error, '계정 탈퇴 정보를 확인하지 못했어요. 다시 시도해 주세요.'));
                    return;
                  }
                  if (ownedTeams.length > 0) {
                    setShowOwnedTeamGuard(true);
                    return;
                  }
                  withdrawal.mutate();
                }}
              >
                {withdrawal.isPending ? '처리 중…' : '계정 삭제'}
              </button>
              <AlertDialog.Cancel className={styles.logoutCancel}>취소 하기</AlertDialog.Cancel>
            </div>
            {withdrawalCheck.isError ? (
              <Button
                className={styles.withdrawalRetry}
                variant="outline"
                onClick={() => {
                  setWithdrawalError(null);
                  void withdrawalCheck.refetch();
                }}
              >
                다시 시도
              </Button>
            ) : null}
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

export function AccountPlan({ settings }: { settings: SettingsData }) {
  const planLabel = settings.plan.label.replace(/\s+\d+\/\d+명$/, '');

  return (
    <Link className={styles.row} href="/settings/subscription" aria-label="구독과 결제">
      <span>구독과 결제</span>
      <span className={styles.trailing}><span className={styles.value}>{planLabel}</span><span className={styles.chevron} aria-hidden="true" /></span>
    </Link>
  );
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
