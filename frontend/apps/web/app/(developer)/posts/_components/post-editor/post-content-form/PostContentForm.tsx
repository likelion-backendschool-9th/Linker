'use client';

// Own region: step 2 of 22 (Figma 274:283) — labels/layout follow the frame
import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { RotateCw, X } from 'lucide-react';
import Image from 'next/image';

import { CharCounter } from '@/components/ui/char-counter/CharCounter';
import { Icon } from '@/components/ui/icon';
import { GitHubMark } from '@/features/github/github-mark/GithubMark';
import { TechTagSheet } from '@/features/tech-tags/tech-tag-sheet/TechTagSheet';
import { countChars } from '@/lib/format/text';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { POST } from '@/lib/policy';

import { PostPeriodSheet, type PeriodField } from '../post-period-sheet';
import styles from './PostContentForm.module.css';
import { usePostContentForm, type PostContentFormProps } from './hook';

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

export function PostContentForm({ onChangeRepo, ...props }: PostContentFormProps) {
  const { repo, photoLimit } = props;
  const {
    field,
    errorId,
    tagSheet,
    creating,
    failure,
    photoWait,
    uploader,
    form,
    errors,
    links,
    watched,
    tags,
    save,
    submit,
    describe,
    removeTag,
    saveTags,
  } = usePostContentForm(props);
  const periodSheet = useOverlay('post-period');
  const { owner, name } = splitRepo(repo.fullName);
  const photoInputId = field('photo-input');
  const { items, max } = uploader;

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
            {onChangeRepo && (
              <button type="button" className={styles.changeRepo} onClick={onChangeRepo}>
                변경 하기
              </button>
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
          <ul className={styles.photos}>
            {items.map((item, index) => (
              <li key={item.key} className={styles.photoCell}>
                <div className={styles.photo}>
                  <Image
                    src={item.previewUrl}
                    alt={`선택한 사진 ${index + 1}`}
                    fill
                    sizes="74px"
                    unoptimized
                    className={styles.photoImage}
                  />
                  {index === 0 && <span className={styles.coverBadge}>대표 이미지</span>}
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
                  <button
                    type="button"
                    className={styles.photoRemove}
                    onClick={() => uploader.remove(item.key)}
                  >
                    <X aria-hidden />
                    <span className="sr-only">사진 {index + 1} 빼기</span>
                  </button>
                </div>
              </li>
            ))}
            {items.length < max && (
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
          <FieldLabel
            label="프로젝트 소개"
            hint="최대 60자"
            required
            htmlFor={field('intro')}
          />
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
              rows={5}
              placeholder="프로젝트에 관해 간단하게 글을 작성해 주세요"
              aria-invalid={errors.body ? true : undefined}
              aria-describedby={describe(field('body-count'), errors.body && errorId('body'))}
              {...form.register('body')}
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

        {/* 내 역할 — Figma 276:416 (dropdown look) */}
        <div className={styles.block}>
          <FieldLabel label="내 역할" htmlFor={field('role')} />
          <div className={styles.selectField}>
            <input
              id={field('role')}
              className={styles.input}
              placeholder="프로젝트 역할을 선택해 주세요"
              aria-invalid={errors.myRole ? true : undefined}
              aria-describedby={errors.myRole ? errorId('role') : undefined}
              {...form.register('myRole')}
            />
            <Icon svg={AltArrowDownLinearIcon} className={styles.selectChevron} />
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
            type="number"
            inputMode="numeric"
            min={POST.teamSize.min}
            max={POST.teamSize.max}
            className={styles.input}
            placeholder="팀 인원을 작성해 주세요"
            aria-invalid={errors.teamSize ? true : undefined}
            aria-describedby={errors.teamSize ? errorId('team') : undefined}
            {...form.register('teamSize')}
          />
          {errors.teamSize && (
            <p id={errorId('team')} className={styles.error}>
              {errors.teamSize.message}
            </p>
          )}
        </div>

        {/* 저장소 태그 — Figma 285:139 */}
        <div className={styles.block}>
          <FieldLabel label="저장소 태그" hint="최대 5개" htmlFor={field('tags')} />
          <button
            type="button"
            id={field('tags')}
            className={styles.tagField}
            onClick={() => tagSheet.open()}
          >
            {tags.length === 0 ? (
              <span className={styles.tagPlaceholder}>#을 기준으로 태그를 나눠주세요</span>
            ) : (
              <span className={styles.tagValue}>{tags.join(' · ')}</span>
            )}
          </button>
          {tags.length > 0 && (
            <ul className={styles.tags} aria-label="선택한 태그">
              {tags.map((tag) => (
                <li key={tag}>
                  <button type="button" className={styles.tag} onClick={() => removeTag(tag)}>
                    <span aria-hidden>{tag}</span>
                    <X aria-hidden className={styles.tagIcon} />
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

      <TechTagSheet value={tags} max={POST.tagsMax} onSave={saveTags} />
      <PostPeriodSheet
        start={watched.periodStart ?? ''}
        end={watched.periodEnd ?? ''}
        onSave={savePeriod}
      />
    </>
  );
}
