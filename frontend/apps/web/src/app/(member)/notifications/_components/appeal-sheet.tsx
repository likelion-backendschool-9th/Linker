'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import {
  notificationKeys,
  submitAppeal,
  updateNotifications,
  type NotificationItem,
  type NotificationPage,
} from '@/features/notifications/notification-queries';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import styles from './notification-list.module.css';

export function AppealSheet({ notification }: { notification: NotificationItem | null }) {
  const overlay = useOverlay('appeal');
  const { login } = useViewer();
  const client = useQueryClient();
  const [body, setBody] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const [invalid, setInvalid] = useState(false);
  function recordSubmitted(sanctionId: number) {
    client.setQueryData<InfiniteData<NotificationPage>>(notificationKeys.list(login), (data) =>
      updateNotifications(data, (item) =>
        item.appeal?.sanctionId === sanctionId
          ? { ...item, appeal: { ...item.appeal, submitted: true } }
          : item,
      ),
    );
  }
  const appeal = useMutation({
    mutationFn: ({ sanctionId, body }: { sanctionId: number; body: string }) =>
      submitAppeal(sanctionId, body),
    onSuccess: async (_, { sanctionId }) => {
      recordSubmitted(sanctionId);
      toast('이의 제기를 접수했어요.');
      await client.invalidateQueries({ queryKey: notificationKeys.list(login) });
    },
    onError: (error, { sanctionId }) => {
      if (error instanceof ApiError && error.code === 'ALREADY_APPEALED') {
        recordSubmitted(sanctionId);
        toast('이미 이의 제기를 접수했어요.');
      }
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    if (!notification?.appeal || notification.appeal.submitted || appeal.isPending) return;
    setInvalid(false);
    appeal.mutate({ sanctionId: notification.appeal.sanctionId, body: body.trim() });
  }
  const duplicate = appeal.error instanceof ApiError && appeal.error.code === 'ALREADY_APPEALED';
  const submitted = notification?.appeal?.submitted || duplicate || appeal.isSuccess;
  return (
    <OverlaySheet
      overlay={overlay}
      title="이의 제기"
      description="이의 제기는 한 번만 접수할 수 있어요. 내용을 확인한 뒤 보내 주세요."
    >
      {!notification?.appeal ? (
        <p>알림 목록에서 이의 제기할 알림을 다시 선택해 주세요.</p>
      ) : submitted ? (
        <div role="status">
          <p>이의 제기를 접수했어요. 검토 결과는 알림으로 안내해 드려요.</p>
          <Button variant="outline" onClick={overlay.close}>
            닫기
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className={styles.form}>
          <p className={styles.title}>{notification.title}</p>
          {notification.body && <p className={styles.description}>{notification.body}</p>}
          <label htmlFor="appeal-body">이의 제기 사유</label>
          <textarea
            ref={input}
            id="appeal-body"
            className={styles.input}
            value={body}
            rows={5}
            required
            aria-invalid={invalid}
            aria-describedby={invalid ? 'appeal-error' : undefined}
            disabled={appeal.isPending}
            onChange={(event) => {
              setBody(event.target.value);
              setInvalid(false);
            }}
          />
          {invalid && (
            <p id="appeal-error" role="alert" className={styles.error}>
              사유를 입력해 주세요.
            </p>
          )}
          {appeal.isError && !duplicate && (
            <ErrorState
              title="이의 제기를 접수하지 못했어요"
              description={
                appeal.error instanceof ApiError
                  ? appeal.error.message
                  : '잠시 후 다시 시도해 주세요.'
              }
            />
          )}
          <Button
            type="submit"
            disabled={appeal.isPending}
            pending={appeal.isPending}
            pendingLabel="접수 중…"
          >
            이의 제기 보내기
          </Button>
        </form>
      )}
    </OverlaySheet>
  );
}
