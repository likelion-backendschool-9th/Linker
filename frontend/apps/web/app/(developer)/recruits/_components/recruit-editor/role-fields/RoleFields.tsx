'use client';

// Own region: the repeating "role + headcount" rows of 20 (POL-R-1, 04 ch. 5 edit exceptions)
import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { MinusLinearIcon } from '@solar-icons/static/linear/minus';
import type { ReactNode } from 'react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';

import { Icon } from '@/components/ui/icon';
import { RECRUIT_ROLE_LABELS, RECRUIT_ROLES } from '@/features/recruit/recruit-labels';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { RECRUIT } from '@/lib/policy';

import type { RecruitFormValues } from '../../../_lib/schema';
import styles from '../RecruitEditor.module.css';
import { RoleSheet } from './RoleSheet';

type RoleFieldsProps = {
  form: UseFormReturn<RecruitFormValues, unknown, RecruitFormValues>;
  idPrefix: string;
  /** Edit: roles with applicants can't be removed or changed */
  lockedRoleIds: number[];
  /** Edit: accepted count per role id, the lowest headcount allowed */
  minHeadcountByRole: Record<string, number>;
  /** Shared required-field dot + sr-only text, built once in RecruitEditor (Figma 257:2592) */
  requiredDot: ReactNode;
};

const { min: HEADCOUNT_MIN, max: HEADCOUNT_MAX } = RECRUIT.headcountPerRole;

export function RoleFields({
  form,
  idPrefix,
  lockedRoleIds,
  minHeadcountByRole,
  requiredDot,
}: RoleFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'roles' });
  const roles = useWatch({ control: form.control, name: 'roles' }) ?? [];
  const errors = form.formState.errors.roles;
  const unused = RECRUIT_ROLES.filter((role) => !roles.some((item) => item?.role === role));
  const headingId = `${idPrefix}-heading`;
  const roleSheet = useOverlay('recruit-role');

  const setHeadcount = (index: number, next: number) =>
    form.setValue(`roles.${index}.headcount`, next, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });

  return (
    <section aria-labelledby={headingId} className={styles.field}>
      <div className={styles.labelRow}>
        <h2 id={headingId} className={styles.label}>
          모집 역할 및 인원
        </h2>
        {requiredDot}
      </div>

      {/* Validation messages go to the editor's top toast (hook.ts), not under the rows */}
      <ul className={styles.roles}>
        {fields.map((item, index) => {
          const current = roles[index];
          const roleId = current?.id ?? null;
          const locked = roleId !== null && lockedRoleIds.includes(roleId);
          const accepted = roleId === null ? 0 : (minHeadcountByRole[roleId] ?? 0);
          const min = Math.max(HEADCOUNT_MIN, accepted);
          const headcount = Number(current?.headcount) || 0;
          const label = current ? RECRUIT_ROLE_LABELS[current.role] : '';
          const rowErrors = errors?.[index];
          const countInput = `${idPrefix}-${index}-count`;
          const countHint = `${countInput}-hint`;

          return (
            <li key={item.id} className={styles.roleRow}>
              <div className={styles.roleMain}>
                <span className={styles.roleName}>{label}</span>

                <div className={styles.stepperInline}>
                  <button
                    type="button"
                    className={styles.stepButton}
                    disabled={headcount <= min}
                    onClick={() => setHeadcount(index, Math.max(min, headcount - 1))}
                  >
                    <span className={styles.stepButtonBox}>
                      <Icon svg={MinusLinearIcon} className={styles.stepIcon} />
                    </span>
                    <span className="sr-only">{label} 인원 줄이기</span>
                  </button>
                  <input
                    id={countInput}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={HEADCOUNT_MAX}
                    aria-label={`${label} 인원`}
                    className={styles.stepValue}
                    aria-invalid={rowErrors?.headcount ? true : undefined}
                    aria-describedby={accepted > 0 ? countHint : undefined}
                    {...form.register(`roles.${index}.headcount`, { valueAsNumber: true })}
                  />
                  <button
                    type="button"
                    className={styles.stepButton}
                    disabled={headcount >= HEADCOUNT_MAX}
                    onClick={() => setHeadcount(index, Math.min(HEADCOUNT_MAX, headcount + 1))}
                  >
                    <span className={styles.stepButtonBox}>
                      <Icon svg={AddBoldIcon} className={styles.stepIcon} />
                    </span>
                    <span className="sr-only">{label} 인원 늘리기</span>
                  </button>
                  {!locked && fields.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => remove(index)}
                    >
                      <span className={styles.removeButtonBox} aria-hidden />
                      <span className="sr-only">{label} 역할 빼기</span>
                    </button>
                  )}
                </div>
              </div>

              {locked && <p className={styles.hint}>지원자가 있는 역할은 빼거나 바꿀 수 없어요.</p>}
              {accepted > 0 && (
                <p id={countHint} className={styles.hint}>
                  이미 {accepted}명을 수락해서 그보다 줄일 수 없어요.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className={styles.addRoleButton}
        disabled={unused.length === 0}
        onClick={() => roleSheet.open()}
      >
        역할 추가
        <Icon svg={AddBoldIcon} className={styles.addRoleIcon} />
      </button>
      {unused.length === 0 && <p className={styles.hint}>모든 역할을 추가했어요.</p>}

      <RoleSheet
        overlay={roleSheet}
        roles={unused}
        onSelect={(role) => append({ id: null, role, headcount: HEADCOUNT_MIN })}
      />
    </section>
  );
}
