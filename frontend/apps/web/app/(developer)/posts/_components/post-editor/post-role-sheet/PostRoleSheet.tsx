'use client';

// Own region: 22 "내 역할" sheet (Figma 666:611) — plain text rows, up to POST.rolePickMax picks
import { useState, type FormEvent } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { POST } from '@/lib/policy';

import styles from './PostRoleSheet.module.css';

/** Rows in Figma order (666:776) */
export const POST_ROLE_OPTIONS = [
  '프론트엔드',
  '백엔드',
  '풀스택',
  '데이터 사이언티스트',
  '인프라',
  '게임',
  '임베디드',
  '보안',
  '클라우드 엔지니어',
  'QA',
] as const;

/** The form keeps "내 역할" as one text value (Policy 40 chars); picks are joined in row order */
const SEPARATOR = ', ';

export function splitRoles(value: string): string[] {
  return value
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
}

export function joinRoles(roles: string[]): string {
  return POST_ROLE_OPTIONS.filter((role) => roles.includes(role)).join(SEPARATOR);
}

type PostRoleSheetProps = {
  /** Current form value, e.g. "프론트엔드, 백엔드" */
  value: string;
  onSave: (value: string) => void;
};

export function PostRoleSheet({ value, onSave }: PostRoleSheetProps) {
  const overlay = useOverlay('post-role');
  return (
    <OverlaySheet
      overlay={overlay}
      title="모집 역할"
      description={`역할을 최대 ${POST.rolePickMax}개까지 골라 주세요.`}
      describeHidden
      classNames={{
        scrim: styles.scrim,
        sheet: styles.sheet,
        header: styles.header,
        title: styles.title,
        close: styles.close,
        body: styles.body,
      }}
    >
      {overlay.isOpen && (
        <RoleChoices
          initial={splitRoles(value)}
          onSave={(roles) => {
            onSave(joinRoles(roles));
            overlay.close();
          }}
        />
      )}
    </OverlaySheet>
  );
}

function RoleChoices({
  initial,
  onSave,
}: {
  initial: string[];
  onSave: (roles: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  const full = picked.length >= POST.rolePickMax;

  function toggle(role: string) {
    setPicked((current) =>
      current.includes(role) ? current.filter((name) => name !== role) : [...current, role],
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Radix portals this form, but React still bubbles submit to the post editor <form>
    event.stopPropagation();
    onSave(picked);
  }

  return (
    <form onSubmit={submit}>
      <fieldset className={styles.choices}>
        <legend className="sr-only">내 역할, 최대 {POST.rolePickMax}개</legend>
        {POST_ROLE_OPTIONS.map((role) => {
          const checked = picked.includes(role);
          return (
            <label key={role} className={styles.choice}>
              <input
                type="checkbox"
                className={styles.checkInput}
                checked={checked}
                disabled={!checked && full}
                onChange={() => toggle(role)}
              />
              {role}
            </label>
          );
        })}
      </fieldset>
      <button type="submit" className={styles.submit}>
        완료
      </button>
    </form>
  );
}
