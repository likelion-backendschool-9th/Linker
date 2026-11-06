'use client';

// Overlay: apply with one role + message (POL-R-3); the profile goes along automatically
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { CharCounter } from '@/components/ui/char-counter/CharCounter';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import type { RecruitDetail } from '../../_lib/detail-queries';
import styles from '../detail-sheets.module.css';
import { useApplyForm, useRecruitApplySheet } from './hook';

export function RecruitApplySheet({ recruit }: { recruit: RecruitDetail }) {
  const overlay = useRecruitApplySheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title="지원하기"
      description="지원할 역할을 고르고 하고 싶은 말을 남겨 주세요."
    >
      {/* Mounted on open, so each attempt starts clean */}
      {overlay.isOpen && <ApplyForm recruit={recruit} overlay={overlay} />}
    </OverlaySheet>
  );
}

function ApplyForm({ recruit, overlay }: { recruit: RecruitDetail; overlay: OverlayControl }) {
  const {
    id,
    roleId,
    setRoleId,
    message,
    setMessage,
    error,
    count,
    messageMax,
    applyPending,
    submit,
    close,
  } = useApplyForm(recruit, overlay);

  return (
    <form className={styles.form} noValidate aria-busy={applyPending} onSubmit={submit}>
      <fieldset
        className={styles.fieldset}
        aria-describedby={error?.field === 'role' ? `${id}-error` : undefined}
      >
        <legend className={styles.label}>
          지원할 역할 <span aria-hidden>*</span>
          <span className="sr-only">(필수)</span>
        </legend>
        <div className={styles.options}>
          {recruit.roles.map((role) => (
            <label key={role.id} className={styles.option}>
              <input
                id={`${id}-role-${role.id}`}
                type="radio"
                name="role"
                className={styles.control}
                checked={roleId === role.id}
                disabled={role.remaining <= 0}
                onChange={() => setRoleId(role.id)}
              />
              <span className={styles.optionTitle}>{role.name}</span>
              <span className={styles.optionMeta}>
                {role.remaining > 0 ? `${role.remaining}명 남음` : '모집 완료'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.field}>
        <label htmlFor={`${id}-message`} className={styles.label}>
          하고 싶은 말<span className={styles.optional}> (선택)</span>
        </label>
        <textarea
          id={`${id}-message`}
          className={styles.textarea}
          rows={5}
          value={message}
          placeholder="참여할 수 있는 시간, 해 보고 싶은 일, 관련 경험을 적어 주세요."
          aria-invalid={error?.field === 'message' ? true : undefined}
          aria-describedby={[`${id}-count`, error?.field === 'message' ? `${id}-error` : null]
            .filter(Boolean)
            .join(' ')}
          onChange={(event) => setMessage(event.target.value)}
        />
        <CharCounter id={`${id}-count`} count={count} max={messageMax} />
      </div>

      <p className={styles.notice}>
        내 프로필(기술 스택, 기여 그래프, 게시물, 완주 기록)이 함께 전달돼요.
      </p>

      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error.text}
        </p>
      )}

      <div className={styles.actions}>
        <Button variant="outline" onClick={close}>
          취소
        </Button>
        <Button type="submit" aria-disabled={applyPending}>
          {applyPending ? '보내는 중…' : '지원하기'}
        </Button>
      </div>
    </form>
  );
}
