'use client';

// Client boundary: the 20 form (react-hook-form + zod), device draft, limit notice, save
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { CloseLinearIcon } from '@solar-icons/static/linear/close';

import { Button } from '@/components/ui/button/Button';
import { CharCounter } from '@/components/ui/char-counter/CharCounter';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { DraftRestoreSheet } from '@/features/draft-restore/draft-restore-sheet/DraftRestoreSheet';
import {
  RECRUIT_FORMATS,
  RECRUIT_FORMAT_LABELS,
  RECRUIT_GOAL_LABELS,
  RECRUIT_GOALS,
} from '@/features/recruit/recruit-labels';
import { TechTagSheet } from '@/features/tech-tags/tech-tag-sheet/TechTagSheet';
import { countChars } from '@/lib/format/text';
import { RECRUIT } from '@/lib/policy';

import { DeadlineSheet } from './deadline-sheet/DeadlineSheet';
import { Dropdown } from './dropdown/Dropdown';
import { RecruitStatusSection } from './recruit-status-section';
import styles from './RecruitEditor.module.css';
import { RoleFields } from './role-fields';
import {
  useRecruitEditor,
  useRecruitEditorForm,
  type RecruitEditorProps,
} from './hook';

/** "2026년 11월 26일" for the deadline dropdown trigger; `date` is a plain `yyyy-MM-dd` calendar value */
function formatDeadlineLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** 20 Write / edit recruit post (07 TODO 20): one form for `/recruits/new` and `/recruits/[id]/edit`. Figma 257:2512 */
export function RecruitEditor(props: RecruitEditorProps) {
  const { options, editForm } = useRecruitEditor(props);

  if (options.isPending || (props.mode === 'edit' && editForm.isPending)) {
    return (
      <div aria-busy="true">
        <p role="status">작성 화면을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  }
  if (options.isError) return <ErrorState onRetry={() => void options.refetch()} />;
  if (props.mode === 'edit' && !editForm.data) {
    return <ErrorState onRetry={() => void editForm.refetch()} />;
  }
  return <EditorForm {...props} options={options.data} editForm={editForm.data ?? null} />;
}

function EditorForm(
  props: RecruitEditorProps & {
    options: NonNullable<ReturnType<typeof useRecruitEditor>['options']['data']>;
    editForm: NonNullable<ReturnType<typeof useRecruitEditor>['editForm']['data']> | null;
  },
) {
  const {
    field,
    errorId,
    describe,
    creating,
    recruitId,
    failure,
    form,
    errors,
    watched,
    format,
    techTags,
    today,
    tagSheet,
    deadlineSheet,
    save,
    submit,
    removeTechTag,
    saveTechTags,
    restoreDraft,
    discardDraft,
    markDeleted,
    editForm,
    options,
  } = useRecruitEditorForm(props);

  // Figma shows a red dot for required fields and no marker at all for optional ones; the
  // sr-only text keeps both states announced to screen readers without relying on color alone.
  const requiredDot = (
    <>
      <span aria-hidden className={styles.requiredDot} />
      <span className={styles.optional}>(필수)</span>
    </>
  );
  const optionalHint = <span className={styles.optional}>(선택 항목)</span>;

  // Figma 257:2580's disabled look gates on the required fields being filled in, same as the
  // zod schema's own requirements; still clickable while "empty" so handleSubmit's errors show
  // where exactly to fix something, rather than leaving a disabled button with no explanation.
  const canSubmit = Boolean(
    watched.title?.trim() &&
      watched.intro?.trim() &&
      (watched.roles?.length ?? 0) > 0 &&
      watched.deadline &&
      (watched.format !== 'OFFLINE' || watched.region?.trim()),
  );

  return (
    <div className={styles.editor}>
      <form className={styles.form} noValidate aria-busy={save.isPending} onSubmit={submit}>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={field('title')} className={styles.label}>
              프로젝트 제목
            </label>
            <span className={styles.labelHint}>최대 {RECRUIT.titleMax}자</span>
            {requiredDot}
          </div>
          <input
            id={field('title')}
            className={styles.input}
            placeholder="프로젝트 제목을 작성해 주세요."
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? errorId('title') : undefined}
            {...form.register('title')}
          />
          {errors.title && (
            <p id={errorId('title')} className={styles.error}>
              {errors.title.message}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={field('intro')} className={styles.label}>
              프로젝트 소개
            </label>
            <span className={styles.labelHint}>최대 {RECRUIT.introMax.toLocaleString('ko-KR')}자</span>
            {requiredDot}
          </div>
          <div className={styles.introField}>
            <textarea
              id={field('intro')}
              className={styles.textarea}
              placeholder="프로젝트에 관해 간단하게 글을 작성해 주세요"
              aria-invalid={errors.intro ? true : undefined}
              aria-describedby={describe(field('intro-count'), errors.intro && errorId('intro'))}
              {...form.register('intro')}
            />
            <CharCounter
              id={field('intro-count')}
              count={countChars(watched.intro ?? '')}
              max={RECRUIT.introMax}
              className={styles.introCounter}
            />
          </div>
          {errors.intro && (
            <p id={errorId('intro')} className={styles.error}>
              {errors.intro.message}
            </p>
          )}
        </div>

        <RoleFields
          form={form}
          idPrefix={field('roles')}
          lockedRoleIds={editForm?.lockedRoleIds ?? []}
          minHeadcountByRole={editForm?.minHeadcountByRole ?? {}}
          requiredDot={requiredDot}
        />

        <fieldset className={styles.fieldset}>
          <legend className={styles.labelRow}>
            <span className={styles.label}>진행 방식</span>
            {requiredDot}
          </legend>
          <div className={styles.chips}>
            {RECRUIT_FORMATS.map((item) => (
              <label key={item} className={styles.chip}>
                <input
                  type="radio"
                  value={item}
                  className={styles.radio}
                  {...form.register('format')}
                />
                {RECRUIT_FORMAT_LABELS[item]}
              </label>
            ))}
          </div>
        </fieldset>

        {format !== 'ONLINE' && (
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor={field('region')} className={styles.label}>
                지역
              </label>
              {format === 'OFFLINE' ? requiredDot : optionalHint}
            </div>
            <input
              id={field('region')}
              className={styles.input}
              placeholder="예: 서울 강남"
              aria-invalid={errors.region ? true : undefined}
              aria-describedby={errors.region ? errorId('region') : undefined}
              {...form.register('region')}
            />
            {errors.region && (
              <p id={errorId('region')} className={styles.error}>
                {errors.region.message}
              </p>
            )}
          </div>
        )}

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <span id={field('deadline')} className={styles.label}>
              공고 마감일
            </span>
            {requiredDot}
          </div>
          <button
            type="button"
            aria-labelledby={field('deadline')}
            aria-describedby={errors.deadline ? errorId('deadline') : undefined}
            className={styles.dropdownTrigger}
            onClick={() => deadlineSheet.open()}
          >
            <span className={watched.deadline ? undefined : styles.dropdownPlaceholder}>
              {watched.deadline ? formatDeadlineLabel(watched.deadline) : '마감일을 설정해 주세요'}
            </span>
            <Icon svg={AltArrowDownLinearIcon} className={styles.dropdownChevron} />
          </button>
          {errors.deadline && (
            <p id={errorId('deadline')} className={styles.error}>
              {errors.deadline.message}
            </p>
          )}
          <DeadlineSheet
            overlay={deadlineSheet}
            value={watched.deadline ?? ''}
            min={today}
            max={options.maxDeadlineDate}
            onSave={(iso) =>
              form.setValue('deadline', iso, {
                shouldDirty: true,
                shouldValidate: form.formState.isSubmitted,
              })
            }
          />
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={field('duration')} className={styles.label}>
              예상 기간
            </label>
            {optionalHint}
          </div>
          <input
            id={field('duration')}
            className={styles.input}
            placeholder="예: 2주, 3개월"
            {...form.register('duration')}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <span id={field('goal')} className={styles.label}>
              프로젝트 목적
            </span>
            {optionalHint}
          </div>
          <Dropdown
            aria-labelledby={field('goal')}
            value={watched.goal ?? ''}
            placeholder="프로젝트 목적을 선택해 주세요"
            options={RECRUIT_GOALS.map((item) => ({ value: item, label: RECRUIT_GOAL_LABELS[item] }))}
            onChange={(next) =>
              form.setValue('goal', next as (typeof RECRUIT_GOALS)[number] | '', {
                shouldDirty: true,
              })
            }
          />
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <span id={field('tags')} className={styles.label}>
              기술 스택
            </span>
            {optionalHint}
          </div>
          <button
            type="button"
            aria-labelledby={field('tags')}
            className={styles.dropdownTrigger}
            onClick={() => tagSheet.open()}
          >
            <span className={techTags.length === 0 ? styles.dropdownPlaceholder : undefined}>
              {techTags.length === 0 ? '기술 스택을 선택해 주세요' : techTags.join(', ')}
            </span>
            <Icon svg={AltArrowDownLinearIcon} className={styles.dropdownChevron} />
          </button>
          {techTags.length > 0 && (
            <ul className={styles.tags} aria-label="고른 기술 스택">
              {techTags.map((tag) => (
                <li key={tag}>
                  <button type="button" className={styles.tag} onClick={() => removeTechTag(tag)}>
                    <span aria-hidden>{tag}</span>
                    <Icon svg={CloseLinearIcon} className={styles.chipIcon} />
                    <span className="sr-only">{tag} 빼기</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <span id={field('team-select')} className={styles.label}>
              연결할 팀
            </span>
            {optionalHint}
          </div>
          <Dropdown
            aria-labelledby={field('team-select')}
            value={watched.teamId ?? ''}
            placeholder="팀 없이 작성"
            emptyIsPlaceholder={false}
            options={options.teams.map((team) => ({ value: String(team.id), label: team.name }))}
            onChange={(next) => form.setValue('teamId', next, { shouldDirty: true })}
          />
        </div>

        {failure && (
          <div className={styles.failure} role="alert">
            <p>{failure}</p>
            <Button variant="outline" onClick={() => void submit()}>
              다시 보내기
            </Button>
          </div>
        )}

        <div className={styles.submitBar}>
          {/* Stays clickable even when "disabled" (Figma 257:2580 look): at the cap, the
              server's PLAN_LIMIT reopens the limit sheet, and while required fields are empty
              submitting still runs validation and points at what's missing. */}
          <Button
            type="submit"
            block
            className={styles.submitButton}
            aria-disabled={save.isPending || !canSubmit}
          >
            {save.isPending ? '저장하는 중…' : creating ? '모집 글 올리기' : '수정 완료'}
          </Button>
        </div>
      </form>

      {editForm && recruitId && (
        <RecruitStatusSection
          recruitId={recruitId}
          status={editForm.status}
          onDeleted={markDeleted}
        />
      )}

      <TechTagSheet
        value={techTags}
        max={RECRUIT.techTagsMax}
        onSave={saveTechTags}
        variant="filled"
      />
      <DraftRestoreSheet onRestore={restoreDraft} onDiscard={discardDraft} />
    </div>
  );
}
