'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import type { NotificationItem } from '@/features/notifications/notification-queries';
import { ApiError } from '@/lib/api/api-error';

import styles from './AppealSheet.module.css';

import { useAppealSheet } from './hook';

export function AppealSheet({ notification }: { notification: NotificationItem | null }) {
  const {
    overlay,
    body,
    setBody,
    input,
    invalid,
    setInvalid,
    appeal,
    submit,
    duplicate,
    submitted,
  } = useAppealSheet(notification);

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
          <Button type="submit" disabled={appeal.isPending}>
            {appeal.isPending ? '접수 중…' : '이의 제기 보내기'}
          </Button>
        </form>
      )}
    </OverlaySheet>
  );
}
