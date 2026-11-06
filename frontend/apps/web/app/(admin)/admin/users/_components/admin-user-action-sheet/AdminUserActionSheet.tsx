'use client';

// overlay: mounted outside the mobile detail sheet; preview validation never sends a mutation
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { formatDate } from '@/lib/format/time';
import { SUBSCRIPTION_RULES } from '@/lib/policy';

import styles from '../../../_components/admin-data.module.css';
import type { AdminUserDetail } from './api';
import { ACTION_TITLES, useAdminActionForm, useAdminUserActionSheet } from './hook';

export function AdminUserActionSheet() {
  const { overlay, kind, paymentId, user } = useAdminUserActionSheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title={ACTION_TITLES[kind] ?? '운영 조치'}
      description="입력 화면 미리보기예요. 제재·해제·열람·환불은 실행되지 않아요."
    >
      {user.isPending ? (
        <Skeleton />
      ) : user.isError ? (
        <ErrorState onRetry={() => void user.refetch()} />
      ) : (
        <AdminActionForm
          key={overlay.id}
          user={user.data}
          kind={kind}
          paymentId={paymentId}
          close={overlay.close}
        />
      )}
    </OverlaySheet>
  );
}

function AdminActionForm({
  user,
  kind,
  paymentId,
  close,
}: {
  user: AdminUserDetail;
  kind: string;
  paymentId?: string;
  close: () => void;
}) {
  const {
    error,
    checked,
    refundConfirmed,
    refundError,
    confirmation,
    reason,
    payment,
    reasonLabel,
    denied,
    handlers,
  } = useAdminActionForm({ user, kind, paymentId });

  return (
    <form className={styles.stack} noValidate onSubmit={handlers.onSubmit}>
      <p>
        {user.name} · @{user.login}
      </p>
      {kind === 'sanction' && (
        <div className={styles.field}>
          <label htmlFor="sanction-step">제재 단계</label>
          <select id="sanction-step" className={styles.input}>
            <option value="WARNING">경고</option>
            <option value="DAYS_7">7일 이용 제한</option>
            <option value="DAYS_30">30일 이용 제한</option>
            <option value="PERMANENT" disabled={!user.allowedActions.permanentSanction}>
              영구 정지 · 리드 운영자만 가능
            </option>
          </select>
          <p className={styles.note}>
            이용자에게 제재 사유와 기간을 알려요. 영구 정지는 리드 운영자만 할 수 있어요.
          </p>
        </div>
      )}
      {kind === 'lift' && (
        <>
          <div className={styles.field}>
            <label htmlFor="lift-sanction">해제할 제재</label>
            <select id="lift-sanction" className={styles.input} disabled={denied}>
              {user.sanctions.map((sanction) => (
                <option key={sanction.id} value={sanction.id}>
                  {formatDate(sanction.startsAt)} · {sanction.reason}
                </option>
              ))}
            </select>
          </div>
          <p className={styles.note}>
            {denied
              ? '제재 해제는 리드 운영자만 할 수 있어요.'
              : '제재 해제는 이용 상태에 영향을 줘요. 대상과 사유를 확인해 주세요.'}
          </p>
        </>
      )}
      {kind === 'refund' && (
        <>
          {payment ? (
            <p>
              결제 #{payment.id} · {formatDate(payment.paidAt)} ·{' '}
              {payment.amount.toLocaleString('ko-KR')}원
            </p>
          ) : (
            <p>환불할 결제를 찾지 못했어요.</p>
          )}
          <p className={styles.note}>
            결제 후 {SUBSCRIPTION_RULES.refundWithinDays}일 이내이며 혜택을 사용하지 않은 경우 전액
            환불해요. 최종 환불 가능 여부는 서버에서 확인해요.
          </p>
          <label className={styles.choice}>
            <input
              ref={confirmation}
              type="checkbox"
              checked={refundConfirmed}
              aria-invalid={refundError}
              aria-describedby={refundError ? 'refund-confirm-error' : undefined}
              onChange={(event) => handlers.onRefundConfirmChange(event.target.checked)}
            />{' '}
            대상 결제와 환불 금액을 확인했어요
          </label>
          {refundError && (
            <p id="refund-confirm-error" role="alert" className={styles.error}>
              대상 결제와 환불 금액을 확인해 주세요.
            </p>
          )}
        </>
      )}
      {kind === 'email' && (
        <p className={styles.note}>
          이메일: {user.emailMasked} · 사유를 기록하기 전에는 전체 이메일을 표시하지 않아요.
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor="admin-action-reason">{reasonLabel} (필수)</label>
        <textarea
          ref={reason}
          id="admin-action-reason"
          className={styles.input}
          placeholder="구체적인 사유를 적어 주세요"
          required
          aria-invalid={error}
          aria-describedby={error ? 'admin-reason-error' : undefined}
          onChange={handlers.onReasonChange}
        />
        {error && (
          <p id="admin-reason-error" role="alert" className={styles.error}>
            사유를 입력해 주세요
          </p>
        )}
      </div>
      <p className={styles.note}>
        운영자의 조치는 사유와 함께 기록돼요. 지금은 입력 내용만 확인할 수 있어요.
      </p>
      {checked && (
        <p role="status" className={styles.note}>
          입력 내용을 확인했어요. 조치는 실행되지 않았어요.
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="outline" onClick={close}>
          취소
        </Button>
        <Button type="submit" variant="outline" disabled={denied}>
          입력 내용 확인
        </Button>
        <Button disabled>
          {kind === 'email'
            ? '사유 기록 후 열람'
            : kind === 'lift'
              ? '제재 해제'
              : kind === 'refund'
                ? '환불 실행'
                : '제재 적용'}
        </Button>
      </div>
    </form>
  );
}
