'use client';

// Own region: the repeating "role + headcount" rows of 20 (POL-R-1, 04 ch. 5 edit exceptions)
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { RECRUIT_ROLE_LABELS, RECRUIT_ROLES } from '@/features/recruit/recruit-labels';
import { RECRUIT } from '@/lib/policy';

import type { RecruitFormValues } from '../../_lib/schema';
import styles from './recruit-editor.module.css';

type RoleFieldsProps = {
  form: UseFormReturn<RecruitFormValues, unknown, RecruitFormValues>;
  idPrefix: string;
  /** Edit: roles with applicants can't be removed or changed */
  lockedRoleIds: number[];
  /** Edit: accepted count per role id, the lowest headcount allowed */
  minHeadcountByRole: Record<string, number>;
};

const { min: HEADCOUNT_MIN, max: HEADCOUNT_MAX } = RECRUIT.headcountPerRole;

export function RoleFields({ form, idPrefix, lockedRoleIds, minHeadcountByRole }: RoleFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'roles' });
  const roles = useWatch({ control: form.control, name: 'roles' }) ?? [];
  const errors = form.formState.errors.roles;
  const unused = RECRUIT_ROLES.filter((role) => !roles.some((item) => item?.role === role));
  const headingId = `${idPrefix}-heading`;
  const listErrorId = `${idPrefix}-error`;
  // Array-level message (e.g. "add at least one") sits on `root` or the array itself
  const listError = errors?.root?.message ?? errors?.message;

  const setHeadcount = (index: number, next: number) =>
    form.setValue(`roles.${index}.headcount`, next, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.sectionTitle}>
        모집 역할
        <span aria-hidden> *</span>
        <span className="sr-only">(필수)</span>
      </h2>
      <p className={styles.hint}>
        역할마다 {HEADCOUNT_MIN}~{HEADCOUNT_MAX}명까지 모집할 수 있어요.
      </p>

      <ul className={styles.roles} aria-describedby={listError ? listErrorId : undefined}>
        {fields.map((item, index) => {
          const current = roles[index];
          const roleId = current?.id ?? null;
          const locked = roleId !== null && lockedRoleIds.includes(roleId);
          const accepted = roleId === null ? 0 : (minHeadcountByRole[roleId] ?? 0);
          const min = Math.max(HEADCOUNT_MIN, accepted);
          const headcount = Number(current?.headcount) || 0;
          const label = current ? RECRUIT_ROLE_LABELS[current.role] : '';
          const rowErrors = errors?.[index];
          // By index: `item.id` is random per render environment and would break hydration
          const roleInput = `${idPrefix}-${index}-role`;
          const countInput = `${idPrefix}-${index}-count`;
          const countHint = `${countInput}-hint`;

          return (
            <li key={item.id} className={styles.roleRow}>
              <div className={styles.roleMain}>
                <div className={styles.field}>
                  {locked ? (
                    <>
                      <p className={styles.label}>역할 {index + 1}</p>
                      <p className={styles.lockedRole}>{label}</p>
                    </>
                  ) : (
                    <>
                      <label htmlFor={roleInput} className={styles.label}>
                        역할 {index + 1}
                      </label>
                      <select
                        id={roleInput}
                        className={styles.input}
                        aria-invalid={rowErrors?.role ? true : undefined}
                        aria-describedby={rowErrors?.role ? `${roleInput}-error` : undefined}
                        {...form.register(`roles.${index}.role`)}
                      >
                        {RECRUIT_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {RECRUIT_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor={countInput} className={styles.label}>
                    인원
                  </label>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      className={styles.stepButton}
                      disabled={headcount <= min}
                      onClick={() => setHeadcount(index, Math.max(min, headcount - 1))}
                    >
                      <Minus aria-hidden />
                      <span className="sr-only">{label} 인원 줄이기</span>
                    </button>
                    <input
                      id={countInput}
                      type="number"
                      inputMode="numeric"
                      min={min}
                      max={HEADCOUNT_MAX}
                      className={styles.stepValue}
                      aria-invalid={rowErrors?.headcount ? true : undefined}
                      aria-describedby={
                        [
                          accepted > 0 ? countHint : null,
                          rowErrors?.headcount ? `${countInput}-error` : null,
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                      {...form.register(`roles.${index}.headcount`, { valueAsNumber: true })}
                    />
                    <button
                      type="button"
                      className={styles.stepButton}
                      disabled={headcount >= HEADCOUNT_MAX}
                      onClick={() => setHeadcount(index, Math.min(HEADCOUNT_MAX, headcount + 1))}
                    >
                      <Plus aria-hidden />
                      <span className="sr-only">{label} 인원 늘리기</span>
                    </button>
                  </div>
                </div>

                {!locked && fields.length > 1 && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => remove(index)}
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">{label} 역할 빼기</span>
                  </button>
                )}
              </div>

              {locked && <p className={styles.hint}>지원자가 있는 역할은 빼거나 바꿀 수 없어요.</p>}
              {accepted > 0 && (
                <p id={countHint} className={styles.hint}>
                  이미 {accepted}명을 수락해서 그보다 줄일 수 없어요.
                </p>
              )}
              {rowErrors?.role && (
                <p id={`${roleInput}-error`} className={styles.error}>
                  {rowErrors.role.message}
                </p>
              )}
              {rowErrors?.headcount && (
                <p id={`${countInput}-error`} className={styles.error}>
                  {rowErrors.headcount.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {listError && (
        <p id={listErrorId} className={styles.error}>
          {listError}
        </p>
      )}

      <Button
        variant="outline"
        block
        disabled={unused.length === 0}
        onClick={() => append({ id: null, role: unused[0]!, headcount: HEADCOUNT_MIN })}
      >
        <Plus aria-hidden />
        역할 추가
      </Button>
      {unused.length === 0 && <p className={styles.hint}>모든 역할을 추가했어요.</p>}
    </section>
  );
}
