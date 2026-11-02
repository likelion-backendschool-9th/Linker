'use client';

// Overlay: apply with one role + message (POL-R-3); the profile goes along automatically
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { ApiError } from '@/lib/api/api-error';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';
import { RECRUIT } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import { applyToRecruit, type RecruitDetail } from '../_lib/detail-queries';
import styles from './detail-sheets.module.css';

export function RecruitApplySheet({ recruit }: { recruit: RecruitDetail }) {
  const overlay = useOverlay('recruit-apply');
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
  const id = useId();
  const client = useQueryClient();
  const open = recruit.roles.filter((role) => role.remaining > 0);
  const [roleId, setRoleId] = useState<number | null>(open.length === 1 ? open[0]!.id : null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<{ field: 'role' | 'message' | null; text: string } | null>(
    null,
  );
  const count = countChars(message);

  const apply = useMutation({
    mutationFn: (body: { roleId: number; message: string }) =>
      applyToRecruit(String(recruit.id), body),
    onSuccess: async () => {
      overlay.close();
      toast('지원했어요. 결과는 알림으로 알려 드릴게요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === 'RATE_LIMITED') {
        setError({ field: null, text: '오늘은 더 할 수 없어요. 내일 다시 시도해 주세요.' });
      } else if (failure instanceof ApiError && failure.status < 500) {
        setError({ field: null, text: failure.message });
      } else {
        setError({ field: null, text: '지원하지 못했어요. 잠시 후 다시 시도해 주세요.' });
      }
    },
  });

  return (
    <form
      className={styles.form}
      noValidate
      aria-busy={apply.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (apply.isPending) return;
        if (roleId === null) {
          setError({ field: 'role', text: '지원할 역할을 골라 주세요.' });
          document.getElementById(`${id}-role-${open[0]?.id}`)?.focus();
          return;
        }
        if (count > RECRUIT.applyMessageMax) {
          setError({
            field: 'message',
            text: `하고 싶은 말은 ${RECRUIT.applyMessageMax}자까지 쓸 수 있어요.`,
          });
          document.getElementById(`${id}-message`)?.focus();
          return;
        }
        setError(null);
        apply.mutate({ roleId, message: normalizeLineBreaks(message.trim()) });
      }}
    >
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
        <CharCounter id={`${id}-count`} count={count} max={RECRUIT.applyMessageMax} />
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
        <Button variant="outline" onClick={() => overlay.close()}>
          취소
        </Button>
        <Button
          type="submit"
          aria-disabled={apply.isPending}
          pending={apply.isPending}
          pendingLabel="보내는 중…"
        >
          지원하기
        </Button>
      </div>
    </form>
  );
}
