'use client';

// Client boundary: the 20 form (react-hook-form + zod), device draft, limit notice, save
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { CloseBoldIcon } from '@solar-icons/static/bold/close';
import { useLayoutEffect, useRef } from 'react';

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
import { noEmojiField } from '@/lib/format/no-emoji-field';
import { countChars } from '@/lib/format/text';
import { RECRUIT } from '@/lib/policy';

import { DatePickerSheet } from '../../../_components/date-picker-sheet';

import { Dropdown } from './dropdown/Dropdown';
import { RecruitStatusSection } from './recruit-status-section';
import styles from './RecruitEditor.module.css';
import { headcountTotalMax } from './api';
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
    creating,
    recruitId,
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
    flexTeamIds,
  } = useRecruitEditorForm(props);
  const totalMax = headcountTotalMax(watched.teamId ?? '', flexTeamIds);
  const headcountTotal = (watched.roles ?? []).reduce(
    (sum, role) => sum + (Number(role?.headcount) || 0),
    0,
  );

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
  // 프로젝트 소개 grows with its text instead of scrolling (CSS keeps the 120px minimum)
  // POL-R-1: no emoji. Text fields drop them as typed or pasted instead of showing an error
  const introField = noEmojiField(form.register('intro'));
  const introRef = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const element = introRef.current;
    if (!element) return;
    element.style.height = 'auto';
    // border-box: scrollHeight leaves out the 2px border on each side, so add it back
    element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
  }, [watched.intro]);

  const canSubmit = Boolean(
    watched.title?.trim() &&
      watched.intro?.trim() &&
      (watched.roles?.length ?? 0) > 0 &&
      watched.deadline &&
      watched.teamId &&
      (totalMax === null || headcountTotal <= totalMax) &&
      (watched.format !== 'OFFLINE' || watched.region?.trim()),
  );

  // 예상 기간 takes whole months only: keep digits, no leading zero, at most 2 digits
  const durationField = form.register('duration');

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
            {...noEmojiField(form.register('title'))}
          />
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
              rows={1}
              placeholder="프로젝트에 관해 간단하게 글을 작성해 주세요"
              aria-invalid={errors.intro ? true : undefined}
              aria-describedby={field('intro-count')}
              {...introField}
              ref={(element) => {
                introField.ref(element);
                introRef.current = element;
              }}
            />
            <CharCounter
              id={field('intro-count')}
              count={countChars(watched.intro ?? '')}
              max={RECRUIT.introMax}
              className={styles.introCounter}
            />
          </div>
        </div>

        {/* Figma 600:715: a post must link a team I own or admin (POL-R-1) — invites on 21 add
            people to it — so the notice stays under the field even when a team is chosen */}
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <span id={field('team-select')} className={styles.label}>
              팀 선택
            </span>
            {requiredDot}
          </div>
          <Dropdown
            aria-labelledby={field('team-select')}
            aria-describedby={field('team-notice')}
            invalid={Boolean(errors.teamId)}
            value={watched.teamId ?? ''}
            placeholder={options.teams.length === 0 ? '연결할 수 있는 팀이 없어요' : '팀을 선택해 주세요'}
            disabled={options.teams.length === 0}
            options={options.teams.map((team) => ({ value: String(team.id), label: team.name }))}
            onChange={(next) =>
              form.setValue('teamId', next, {
                shouldDirty: true,
                shouldValidate: form.formState.isSubmitted,
              })
            }
          />
          <p id={field('team-notice')} className={styles.notice}>
            <span aria-hidden className={styles.noticeDot} />
            팀이 없으면 모집글을 작성할 수 없습니다.
          </p>
        </div>

        <RoleFields
          form={form}
          idPrefix={field('roles')}
          lockedRoleIds={editForm?.lockedRoleIds ?? []}
          minHeadcountByRole={editForm?.minHeadcountByRole ?? {}}
          requiredDot={requiredDot}
          headcountTotalMax={totalMax}
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
              maxLength={RECRUIT.regionMax}
              aria-invalid={errors.region ? true : undefined}
              {...noEmojiField(form.register('region'))}
            />
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
            className={
              errors.deadline ? `${styles.dropdownTrigger} ${styles.invalid}` : styles.dropdownTrigger
            }
            onClick={() => deadlineSheet.open()}
          >
            <span className={watched.deadline ? undefined : styles.dropdownPlaceholder}>
              {watched.deadline ? formatDeadlineLabel(watched.deadline) : '마감일을 설정해 주세요'}
            </span>
            <Icon svg={AltArrowDownLinearIcon} className={styles.dropdownChevron} />
          </button>
          <DatePickerSheet
            overlay={deadlineSheet}
            title="마감일"
            description="마감일을 고르고 저장을 누르면 반영돼요."
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
          <div className={styles.unitField}>
            <input
              id={field('duration')}
              className={`${styles.input} ${styles.unitInput}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={String(RECRUIT.durationMonths.max).length}
              placeholder="예: 3"
              aria-invalid={errors.duration ? true : undefined}
              aria-describedby={field('duration-unit')}
              {...durationField}
              onChange={(event) => {
                event.target.value = event.target.value
                  .replace(/\D/g, '')
                  .replace(/^0+/, '')
                  .slice(0, String(RECRUIT.durationMonths.max).length);
                return durationField.onChange(event);
              }}
            />
            <span id={field('duration-unit')} className={styles.unit}>
              개월
            </span>
          </div>
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
            {/* Always the placeholder: what's chosen shows only as the chips below */}
            <span className={styles.dropdownPlaceholder}>기술 스택을 선택해 주세요</span>
            <Icon svg={AltArrowDownLinearIcon} className={styles.dropdownChevron} />
          </button>
          {techTags.length > 0 && (
            <ul className={styles.tags} aria-label="고른 기술 스택">
              {techTags.map((tag) => (
                <li key={tag}>
                  <button type="button" className={styles.tag} onClick={() => removeTechTag(tag)}>
                    <span aria-hidden>{tag}</span>
                    <Icon svg={CloseBoldIcon} className={styles.tagIcon} />
                    <span className="sr-only">{tag} 빼기</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.submitBar}>
          {/* Stays clickable even when "disabled" (Figma 600:729 look): at the cap, the
              server's PLAN_LIMIT reopens the limit sheet, and while required fields are empty
              submitting still runs validation and points at what's missing. */}
          <button
            type="submit"
            className={styles.submitButton}
            aria-disabled={save.isPending || !canSubmit}
          >
            {save.isPending ? '저장하는 중…' : creating ? '모집 글 작성' : '수정 완료'}
          </button>
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
