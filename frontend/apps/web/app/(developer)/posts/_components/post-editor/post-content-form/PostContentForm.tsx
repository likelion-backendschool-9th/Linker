'use client';

// Own region: step 2 of 22 (Figma 274:283) — labels/layout follow the frame
import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { AlbumBoldIcon } from '@solar-icons/static/bold/album';
import { CloseBoldIcon } from '@solar-icons/static/bold/close';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { RotateCw } from 'lucide-react';
import Image from 'next/image';

import { CharCounter } from '@/components/ui/char-counter/CharCounter';
import { Icon } from '@/components/ui/icon';
import { GitHubMark } from '@/features/github/github-mark/GithubMark';
import { countChars } from '@/lib/format/text';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { POST } from '@/lib/policy';

import { PostPeriodSheet, type PeriodField } from '../post-period-sheet';
import { PostRoleSheet } from '../post-role-sheet';
import { RepoChangeSheet } from '../repo-change-sheet';
import styles from './PostContentForm.module.css';
import { usePhotoRowFit, usePostContentForm, type PostContentFormProps } from './hook';

function formatPeriodLabel(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[1]}.${match[2]}`;
}

export type { PostContentFormProps };

function splitRepo(fullName: string) {
  const slash = fullName.indexOf('/');
  if (slash < 0) return { owner: fullName, name: fullName };
  return { owner: fullName.slice(0, slash), name: fullName.slice(slash + 1) };
}

function FieldLabel({
  label,
  hint,
  required,
  htmlFor,
  asLegend,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  asLegend?: boolean;
}) {
  const content = (
    <>
      <span className={styles.label}>{label}</span>
      {hint && <span className={styles.labelHint}>{hint}</span>}
      {required && (
        <>
          <span className={styles.requiredDot} aria-hidden />
          <span className="sr-only">(필수)</span>
        </>
      )}
    </>
  );

  // legend is out of CSS grid flow in fieldsets, so the visible row is a div (gap 12px)
  if (asLegend) {
    return (
      <>
        <legend className="sr-only">{label}</legend>
        <div className={styles.labelRow} aria-hidden>
          {content}
        </div>
      </>
    );
  }

  const Tag = htmlFor ? 'label' : 'div';
  return (
    <Tag className={styles.labelRow} {...(htmlFor ? { htmlFor } : {})}>
      {content}
    </Tag>
  );
}

export function PostContentForm({ repoChange, ...props }: PostContentFormProps) {
  const { repo, photoLimit } = props;
  const {
    field,
    errorId,
    creating,
    failure,
    photoWait,
    uploader,
    form,
    errors,
    links,
    watched,
    tags,
    registerBody,
    registerTeamSize,
    save,
    submit,
    describe,
    removeTag,
    tagInput,
    saveRole,
  } = usePostContentForm(props);
  const periodSheet = useOverlay('post-period');
  const roleSheet = useOverlay('post-role');
  const { owner, name } = splitRepo(repo.fullName);
  const photoInputId = field('photo-input');
  const { items, max } = uploader;
  const { rowRef: photoRowRef, fit: photoFit } = usePhotoRowFit();
  const canAdd = items.length < max;
  // One row only: past the row width the last visible photo carries the album badge (Figma 660:581)
  const shownCount =
    photoFit !== null && items.length + (canAdd ? 1 : 0) > photoFit
      ? Math.max(1, photoFit - (canAdd ? 1 : 0))
      : items.length;
  const shown = items.slice(0, shownCount);
  const hiddenCount = items.length - shown.length;

  function savePeriod(which: PeriodField, value: string) {
    form.setValue(which === 'start' ? 'periodStart' : 'periodEnd', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <>
      <form className={styles.form} noValidate aria-busy={save.isPending} onSubmit={submit}>
        {/* 선택한 저장소 — Figma 274:339 */}
        <section aria-labelledby={field('repo')} className={styles.block}>
          <h2 id={field('repo')} className={styles.label}>
            선택한 저장소
          </h2>
          <div className={styles.repoCard}>
            <div className={styles.repoMain}>
              <GitHubMark className={styles.repoMark} />
              <div className={styles.repoText}>
                <p className={styles.repoName} title={repo.fullName}>
                  {name}
                </p>
                <p className={styles.repoOwner}>
                  <span>@{owner}</span>
                </p>
              </div>
            </div>
            {repoChange && (
              <RepoChangeSheet
                repoId={repo.repoId}
                teamId={repoChange.teamId}
                triggerClassName={styles.changeRepo}
                onChange={repoChange.onChange}
              />
            )}
          </div>
        </section>

        {/* 프로젝트 사진 — Figma 274:315 */}
        <section aria-labelledby={field('photos')} className={styles.block}>
          <FieldLabel
            label="프로젝트 사진"
            hint={`최대 ${photoLimit}장`}
            required
            htmlFor={photoInputId}
          />
          <span id={field('photos')} className="sr-only">
            프로젝트 사진
          </span>
          <ul ref={photoRowRef} className={styles.photos}>
            {shown.map((item, index) => {
              const last = hiddenCount > 0 && index === shown.length - 1;
              return (
                <li key={item.key} className={styles.photoCell}>
                  {/* Tapping the photo removes it */}
                  <button
                    type="button"
                    className={styles.photo}
                    onClick={() => uploader.remove(item.key)}
                  >
                    <Image
                      src={item.previewUrl}
                      alt=""
                      fill
                      sizes="74px"
                      unoptimized
                      className={styles.photoImage}
                    />
                    {index === 0 && <span className={styles.coverBadge}>대표 이미지</span>}
                    {last && (
                      <span className={styles.photoMore}>
                        <Icon svg={AlbumBoldIcon} className={styles.photoMoreIcon} />
                        <span className="sr-only">외 사진 {hiddenCount}장</span>
                      </span>
                    )}
                    <span className="sr-only">사진 {index + 1} 빼기</span>
                  </button>
                  {item.status === 'failed' && (
                    <button
                      type="button"
                      className={styles.photoRetry}
                      onClick={() => uploader.retry(item.key)}
                    >
                      <RotateCw aria-hidden />
                      <span className="sr-only">사진 {index + 1} 다시 올리기</span>
                    </button>
                  )}
                </li>
              );
            })}
            {canAdd && (
              <li className={styles.photoCell}>
                <label htmlFor={photoInputId} className={styles.photoAdd}>
                  <Icon svg={AddBoldIcon} className={styles.photoAddIcon} />
                  <span className={styles.photoAddCount} aria-live="polite">
                    <span className={styles.photoAddMuted}>(</span>
                    <span>{items.length}</span>
                    <span className={styles.photoAddMuted}>/{max})</span>
                  </span>
                  <span className="sr-only">사진 추가</span>
                </label>
              </li>
            )}
          </ul>
          <input
            id={photoInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              const files = event.target.files;
              if (files?.length) uploader.add(files);
              event.target.value = '';
            }}
          />
          {photoWait && !uploader.allDone && (
            <p className={styles.error} role="alert">
              사진이 모두 올라가야 게시할 수 있어요. 실패한 사진은 다시 올리거나 빼 주세요.
            </p>
          )}
        </section>

        {/* 프로젝트 소개 — Figma 274:301 */}
        <div className={styles.block}>
          <FieldLabel label="프로젝트 소개" hint="최대 60자" required htmlFor={field('intro')} />
          <input
            id={field('intro')}
            className={styles.input}
            placeholder="프로젝트 제목을 작성해 주세요."
            aria-invalid={errors.intro ? true : undefined}
            aria-describedby={describe(field('intro-count'), errors.intro && errorId('intro'))}
            {...form.register('intro')}
          />
          {errors.intro && (
            <p id={errorId('intro')} className={styles.error}>
              {errors.intro.message}
            </p>
          )}
          <span className="sr-only">
            <CharCounter
              id={field('intro-count')}
              count={countChars(watched.intro ?? '')}
              max={POST.intro.max}
            />
          </span>
        </div>

        {/* 프로젝트 본문 — Figma 274:329 */}
        <div className={styles.block}>
          <FieldLabel label="프로젝트 본문" hint="최대 500자" required htmlFor={field('body')} />
          <div className={styles.textareaWrap}>
            <textarea
              id={field('body')}
              className={styles.textarea}
              rows={1}
              placeholder="프로젝트에 관해 간단하게 글을 작성해 주세요"
              aria-invalid={errors.body ? true : undefined}
              aria-describedby={describe(field('body-count'), errors.body && errorId('body'))}
              {...registerBody}
            />
            <CharCounter
              id={field('body-count')}
              className={styles.bodyCounter}
              count={countChars(watched.body ?? '')}
              /* Figma 274:332 shows 0/500; Policy POST.bodyMax stays the validation cap */
              max={500}
            />
          </div>
          {errors.body && (
            <p id={errorId('body')} className={styles.error}>
              {errors.body.message}
            </p>
          )}
        </div>

        {/* 내 역할 — Figma 276:416 (dropdown look); picks in the sheet 666:611 */}
        <div className={styles.block}>
          <FieldLabel label="내 역할" htmlFor={field('role')} />
          <div className={styles.selectField}>
            <button
              type="button"
              id={field('role')}
              className={styles.periodTrigger}
              aria-haspopup="dialog"
              aria-describedby={errors.myRole ? errorId('role') : undefined}
              onClick={() => roleSheet.open()}
            >
              {watched.myRole ? (
                <span className={styles.triggerValue}>{watched.myRole}</span>
              ) : (
                <span className={styles.periodPlaceholder}>프로젝트 역할을 선택해 주세요</span>
              )}
            </button>
            <Icon svg={AltArrowDownLinearIcon} className={styles.selectChevron} />
            <input type="hidden" {...form.register('myRole')} />
          </div>
          {errors.myRole && (
            <p id={errorId('role')} className={styles.error}>
              {errors.myRole.message}
            </p>
          )}
        </div>

        {/* 프로젝트 링크 — Figma 276:432 */}
        <fieldset className={styles.block}>
          <FieldLabel label="프로젝트 링크" hint="최대 3개" asLegend />
          <div className={styles.links}>
            {Array.from({ length: POST.demoLinksMax }, (_, index) => {
              const item = links.fields[index];
              if (!item) return null;
              const linkError = errors.demoLinks?.[index]?.url;
              const inputId = field(`link-${index}`);
              return (
                <div key={item.id} className={styles.linkRow}>
                  <label htmlFor={inputId} className="sr-only">
                    데모 링크 {index + 1}
                  </label>
                  <input
                    id={inputId}
                    type="url"
                    inputMode="url"
                    className={styles.input}
                    placeholder="https://"
                    aria-invalid={linkError ? true : undefined}
                    aria-describedby={linkError ? `${inputId}-error` : undefined}
                    {...form.register(`demoLinks.${index}.url`)}
                  />
                  {linkError && (
                    <p id={`${inputId}-error`} className={styles.error}>
                      {linkError.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* 프로젝트 기간 — Figma 285:112; sheet 368:3896 */}
        <fieldset className={styles.block}>
          <FieldLabel label="프로젝트 기간" asLegend />
          <div className={styles.period}>
            <div className={styles.selectField}>
              <button
                type="button"
                id={field('start')}
                className={styles.periodTrigger}
                aria-label={
                  watched.periodStart
                    ? `시작일 ${formatPeriodLabel(watched.periodStart)}`
                    : '시작일'
                }
                aria-invalid={errors.periodStart ? true : undefined}
                aria-describedby={errors.periodStart ? errorId('start') : undefined}
                aria-haspopup="dialog"
                onClick={() => periodSheet.open('start')}
              >
                {watched.periodStart ? (
                  <span aria-hidden>{formatPeriodLabel(watched.periodStart)}</span>
                ) : (
                  <span className={styles.periodPlaceholder} aria-hidden>
                    시작일
                  </span>
                )}
              </button>
              <Icon svg={AltArrowDownLinearIcon} className={styles.selectChevron} />
              <input type="hidden" {...form.register('periodStart')} />
            </div>
            <div className={styles.selectField}>
              <button
                type="button"
                id={field('end')}
                className={styles.periodTrigger}
                aria-label={
                  watched.periodEnd ? `마감일 ${formatPeriodLabel(watched.periodEnd)}` : '마감일'
                }
                aria-invalid={errors.periodEnd ? true : undefined}
                aria-describedby={errors.periodEnd ? errorId('end') : undefined}
                aria-haspopup="dialog"
                onClick={() => periodSheet.open('end')}
              >
                {watched.periodEnd ? (
                  <span aria-hidden>{formatPeriodLabel(watched.periodEnd)}</span>
                ) : (
                  <span className={styles.periodPlaceholder} aria-hidden>
                    마감일
                  </span>
                )}
              </button>
              <Icon svg={AltArrowDownLinearIcon} className={styles.selectChevron} />
              <input type="hidden" {...form.register('periodEnd')} />
            </div>
          </div>
          {errors.periodStart && (
            <p id={errorId('start')} className={styles.error}>
              {errors.periodStart.message}
            </p>
          )}
          {errors.periodEnd && (
            <p id={errorId('end')} className={styles.error}>
              {errors.periodEnd.message}
            </p>
          )}
        </fieldset>

        {/* 팀 규모 — Figma 285:113 */}
        <div className={styles.block}>
          <FieldLabel label="팀 규모" htmlFor={field('team')} />
          <input
            id={field('team')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={String(POST.teamSize.max).length}
            className={styles.input}
            placeholder="팀 인원을 작성해 주세요"
            aria-invalid={errors.teamSize ? true : undefined}
            aria-describedby={errors.teamSize ? errorId('team') : undefined}
            {...registerTeamSize}
          />
          {errors.teamSize && (
            <p id={errorId('team')} className={styles.error}>
              {errors.teamSize.message}
            </p>
          )}
        </div>

        {/* 저장소 태그 — Figma 285:139 */}
        <div className={styles.block}>
          <FieldLabel label="저장소 태그" hint={`최대 ${POST.tagsMax}개`} htmlFor={field('tags')} />
          <input
            id={field('tags')}
            type="text"
            className={styles.input}
            placeholder="#을 기준으로 태그를 나눠주세요"
            autoComplete="off"
            enterKeyHint="done"
            {...tagInput}
          />
          {/* Chips — Figma 666:825 */}
          {tags.length > 0 && (
            <ul className={styles.tags} aria-label="저장소 태그">
              {tags.map((tag) => (
                <li key={tag}>
                  <button type="button" className={styles.tag} onClick={() => removeTag(tag)}>
                    <span aria-hidden>{tag}</span>
                    <Icon svg={CloseBoldIcon} className={styles.tagIcon} />
                    <span className="sr-only">{tag} 빼기</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {failure && (
          <div className={styles.failure} role="alert">
            <p>{failure}</p>
            <button type="button" className={styles.retry} onClick={() => void submit()}>
              다시 보내기
            </button>
          </div>
        )}

        <div className={styles.submitBar}>
          <button type="submit" className={styles.cta} aria-disabled={save.isPending || undefined}>
            {save.isPending ? '저장하는 중…' : creating ? '게시하기' : '수정 완료'}
          </button>
        </div>
      </form>

      <PostRoleSheet value={watched.myRole ?? ''} onSave={saveRole} />
      <PostPeriodSheet
        start={watched.periodStart ?? ''}
        end={watched.periodEnd ?? ''}
        onSave={savePeriod}
      />
    </>
  );
}
