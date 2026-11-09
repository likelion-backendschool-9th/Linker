'use client';

// Overlay: pick one open role and apply (POL-R-3); profile goes along automatically
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import type { RecruitDetail } from '../../_lib/detail-queries';
import sheetStyles from '../detail-sheets.module.css';
import styles from './RecruitApplySheet.module.css';
import { useApplyForm, useRecruitApplySheet } from './hook';

export function RecruitApplySheet({ recruit }: { recruit: RecruitDetail }) {
  const overlay = useRecruitApplySheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title={
        <>
          지원하기
          <span className={styles.requiredDot} aria-hidden />
          <span className="sr-only">(필수)</span>
        </>
      }
      description="지원할 역할을 골라 주세요."
      describeHidden
      classNames={{ sheet: styles.sheet, title: styles.title }}
    >
      {/* Mounted on open, so each attempt starts clean */}
      {overlay.isOpen && <ApplyForm recruit={recruit} overlay={overlay} />}
    </OverlaySheet>
  );
}

function ApplyForm({ recruit, overlay }: { recruit: RecruitDetail; overlay: OverlayControl }) {
  const { id, roleId, setRoleId, error, applyPending, submit } = useApplyForm(recruit, overlay);

  return (
    <form className={styles.form} noValidate aria-busy={applyPending} onSubmit={submit}>
      <fieldset
        className={styles.fieldset}
        aria-label="지원할 역할"
        aria-describedby={error?.field === 'role' ? `${id}-error` : undefined}
      >
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

      {error && (
        <p id={`${id}-error`} className={sheetStyles.error} role="alert">
          {error.text}
        </p>
      )}

      <Button type="submit" block className={styles.applyCta} aria-disabled={applyPending}>
        {applyPending ? '보내는 중…' : '지원하기'}
      </Button>
    </form>
  );
}
