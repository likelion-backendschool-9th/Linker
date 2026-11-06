'use client';

// Client boundary: the 20 form (react-hook-form + zod), device draft, limit notice, save
import { Check, Plus, X } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { CharCounter } from '@/components/ui/char-counter/CharCounter';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { DraftRestoreSheet } from '@/features/draft-restore/draft-restore-sheet/DraftRestoreSheet';
import {
  RECRUIT_FORMAT_LABELS,
  RECRUIT_FORMATS,
  RECRUIT_GOAL_LABELS,
  RECRUIT_GOALS,
} from '@/features/recruit/recruit-labels';
import { TechTagSheet } from '@/features/tech-tags/tech-tag-sheet/TechTagSheet';
import { countChars } from '@/lib/format/text';
import { RECRUIT } from '@/lib/policy';

import { RecruitStatusSection } from './recruit-status-section';
import styles from './RecruitEditor.module.css';
import { RoleFields } from './role-fields';
import {
  useRecruitEditor,
  useRecruitEditorForm,
  type RecruitEditorProps,
} from './hook';

/** 20 Write / edit recruit post (07 TODO 20): one form for `/recruits/new` and `/recruits/[id]/edit` */
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
    atLimit,
    failure,
    form,
    errors,
    watched,
    format,
    techTags,
    today,
    tagSheet,
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

  const required = (
    <>
      {' '}
      <span aria-hidden>*</span>
      <span className="sr-only">(필수)</span>
    </>
  );

  return (
    <div className={styles.editor}>
      {creating && (
        <div className={atLimit ? styles.limitFull : styles.limit} role="status">
          <p>
            모집 중인 글 {options.openCount}/{options.openLimit}개
          </p>
          {atLimit && (
            <p className={styles.limitText}>
              지금은 새 글을 올릴 수 없어요. 모집 중인 글을 마감하면 다시 쓸 수 있어요.{' '}
              <Link href="/recruits?tab=mine" className={styles.inlineLink}>
                내 모집 글 보기
              </Link>
            </p>
          )}
        </div>
      )}

      <form className={styles.form} noValidate aria-busy={save.isPending} onSubmit={submit}>
        <section aria-labelledby={field('basic')} className={styles.section}>
          <h2 id={field('basic')} className={styles.sectionTitle}>
            기본 정보
          </h2>
          <div className={styles.field}>
            <label htmlFor={field('title')} className={styles.label}>
              제목{required}
            </label>
            <input
              id={field('title')}
              className={styles.input}
              placeholder="예: 해커톤 같이 나갈 백엔드 개발자 모집"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={describe(field('title-count'), errors.title && errorId('title'))}
              {...form.register('title')}
            />
            <div className={styles.fieldFoot}>
              {errors.title && (
                <p id={errorId('title')} className={styles.error}>
                  {errors.title.message}
                </p>
              )}
              <CharCounter
                id={field('title-count')}
                count={countChars(watched.title ?? '')}
                max={RECRUIT.titleMax}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor={field('intro')} className={styles.label}>
              소개{required}
            </label>
            <textarea
              id={field('intro')}
              className={styles.textarea}
              rows={8}
              placeholder="어떤 프로젝트인지, 어떻게 진행하는지, 어떤 분과 함께하고 싶은지 적어 주세요."
              aria-invalid={errors.intro ? true : undefined}
              aria-describedby={describe(field('intro-count'), errors.intro && errorId('intro'))}
              {...form.register('intro')}
            />
            <div className={styles.fieldFoot}>
              {errors.intro && (
                <p id={errorId('intro')} className={styles.error}>
                  {errors.intro.message}
                </p>
              )}
              <CharCounter
                id={field('intro-count')}
                count={countChars(watched.intro ?? '')}
                max={RECRUIT.introMax}
              />
            </div>
          </div>
        </section>

        <RoleFields
          form={form}
          idPrefix={field('roles')}
          lockedRoleIds={editForm?.lockedRoleIds ?? []}
          minHeadcountByRole={editForm?.minHeadcountByRole ?? {}}
        />

        <section aria-labelledby={field('how')} className={styles.section}>
          <h2 id={field('how')} className={styles.sectionTitle}>
            진행 방식
          </h2>
          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>방식{required}</legend>
            <div className={styles.chips}>
              {RECRUIT_FORMATS.map((item) => (
                <label key={item} className={styles.chip}>
                  <input
                    type="radio"
                    value={item}
                    className={styles.radio}
                    {...form.register('format')}
                  />
                  {format === item && <Check aria-hidden className={styles.chipIcon} />}
                  {RECRUIT_FORMAT_LABELS[item]}
                </label>
              ))}
            </div>
          </fieldset>

          {format !== 'ONLINE' && (
            <div className={styles.field}>
              <label htmlFor={field('region')} className={styles.label}>
                지역
                {format === 'OFFLINE' ? required : <span className={styles.optional}> (선택)</span>}
              </label>
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
            <label htmlFor={field('deadline')} className={styles.label}>
              모집 마감일{required}
            </label>
            <input
              id={field('deadline')}
              type="date"
              className={styles.input}
              min={today}
              max={options.maxDeadlineDate}
              aria-invalid={errors.deadline ? true : undefined}
              aria-describedby={describe(
                field('deadline-hint'),
                errors.deadline && errorId('deadline'),
              )}
              {...form.register('deadline')}
            />
            <p id={field('deadline-hint')} className={styles.hint}>
              오늘부터 {RECRUIT.deadlineWithinDays}일 안으로 고를 수 있어요. 마감일이 지나거나
              인원이 다 차면 자동으로 마감돼요.
            </p>
            {errors.deadline && (
              <p id={errorId('deadline')} className={styles.error}>
                {errors.deadline.message}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={field('duration')} className={styles.label}>
              예상 기간<span className={styles.optional}> (선택)</span>
            </label>
            <input
              id={field('duration')}
              className={styles.input}
              placeholder="예: 2주, 3개월"
              {...form.register('duration')}
            />
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>
              목표<span className={styles.optional}> (선택)</span>
            </legend>
            <div className={styles.chips}>
              {(['', ...RECRUIT_GOALS] as const).map((item) => (
                <label key={item || 'none'} className={styles.chip}>
                  <input
                    type="radio"
                    value={item}
                    className={styles.radio}
                    {...form.register('goal')}
                  />
                  {(watched.goal ?? '') === item && (
                    <Check aria-hidden className={styles.chipIcon} />
                  )}
                  {item ? RECRUIT_GOAL_LABELS[item] : '정하지 않음'}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section aria-labelledby={field('tags')} className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 id={field('tags')} className={styles.sectionTitle}>
              기술 스택<span className={styles.optional}> (선택)</span>
            </h2>
            <Button variant="soft" onClick={() => tagSheet.open()}>
              <Plus aria-hidden />
              {techTags.length > 0 ? '바꾸기' : '고르기'}
            </Button>
          </div>
          {techTags.length === 0 ? (
            <p className={styles.hint}>
              최대 {RECRUIT.techTagsMax}개까지 고를 수 있어요. 목록 필터에 쓰여요.
            </p>
          ) : (
            <ul className={styles.tags} aria-label="고른 기술 스택">
              {techTags.map((tag) => (
                <li key={tag}>
                  <button type="button" className={styles.tag} onClick={() => removeTechTag(tag)}>
                    <span aria-hidden>{tag}</span>
                    <X aria-hidden className={styles.chipIcon} />
                    <span className="sr-only">{tag} 빼기</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby={field('team')} className={styles.section}>
          <h2 id={field('team')} className={styles.sectionTitle}>
            팀 연결<span className={styles.optional}> (선택)</span>
          </h2>
          <div className={styles.field}>
            <label htmlFor={field('team-select')} className={styles.label}>
              연결할 팀
            </label>
            <select
              id={field('team-select')}
              className={styles.input}
              aria-describedby={field('team-hint')}
              {...form.register('teamId')}
            >
              <option value="">팀 없이 쓰기</option>
              {options.teams.map((team) => (
                <option key={team.id} value={String(team.id)}>
                  {team.name}
                </option>
              ))}
            </select>
            <p id={field('team-hint')} className={styles.hint}>
              {options.teams.length === 0
                ? '연결할 수 있는 팀이 없어요. 오너나 관리자인 팀만 연결할 수 있어요. '
                : '오너나 관리자인 팀만 연결할 수 있어요. '}
              팀 없이도 쓸 수 있고, 첫 지원자를 수락할 때 팀을 만들면 돼요.
            </p>
          </div>
        </section>

        {failure && (
          <div className={styles.failure} role="alert">
            <p>{failure}</p>
            <Button variant="outline" onClick={() => void submit()}>
              다시 보내기
            </Button>
          </div>
        )}

        <div className={styles.submitBar}>
          {/* Stays pressable at the cap: the server's PLAN_LIMIT reopens the limit sheet */}
          <Button type="submit" block aria-disabled={save.isPending}>
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

      <TechTagSheet value={techTags} max={RECRUIT.techTagsMax} onSave={saveTechTags} />
      <DraftRestoreSheet onRestore={restoreDraft} onDiscard={discardDraft} />
    </div>
  );
}
