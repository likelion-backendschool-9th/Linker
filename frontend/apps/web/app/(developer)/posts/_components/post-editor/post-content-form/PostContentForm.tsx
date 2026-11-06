'use client';

// Own region: step 2 of 22 (and the edit screen): repo card, intro, body, photos, optional fields
import { ExternalLink, GitFork, Plus, Star, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button/Button';
import { CharCounter } from '@/components/ui/char-counter/CharCounter';
import { ImageUploader } from '@/features/image-upload/image-uploader/ImageUploader';
import { TechTagSheet } from '@/features/tech-tags/tech-tag-sheet/TechTagSheet';
import { countChars } from '@/lib/format/text';
import { POST } from '@/lib/policy';

import styles from '../post-editor.module.css';
import { GITHUB_EMAIL_SETTINGS, usePostContentForm, type PostContentFormProps } from './hook';

export type { PostContentFormProps };

export function PostContentForm(props: PostContentFormProps) {
  const { repo } = props;
  const {
    field,
    errorId,
    openExternal,
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
  const optional = <span className={styles.optional}> (선택)</span>;

  return (
    <>
      <section aria-labelledby={field('repo')} className={styles.repoCard}>
        <h2 id={field('repo')} className={styles.repoCardName}>
          {repo.fullName}
        </h2>
        <p className={styles.repoMeta}>
          {repo.language && <span>{repo.language}</span>}
          <span className={styles.stars}>
            <Star aria-hidden className={styles.metaIcon} />
            <span className="sr-only">스타 </span>
            {repo.stars}
          </span>
          {repo.isFork && (
            <span className={styles.fork}>
              <GitFork aria-hidden className={styles.metaIcon} />
              포크{repo.parentFullName && ` · 원본 ${repo.parentFullName}`}
            </span>
          )}
        </p>
        {repo.description && <p className={styles.repoDescription}>{repo.description}</p>}
        <dl className={styles.contribution}>
          <div>
            <dt>내 커밋</dt>
            <dd>{repo.authorCommitCount}개</dd>
          </div>
          <div>
            <dt>Linker에서 처리한 이슈</dt>
            <dd>{repo.handledIssueCount}개</dd>
          </div>
        </dl>
        {repo.authorCommitCount === 0 && (
          <div className={styles.commitNotice}>
            <p>커밋에 쓴 이메일이 GitHub 계정에 등록돼 있어야 숫자에 잡혀요.</p>
            <Button variant="outline" onClick={() => openExternal(GITHUB_EMAIL_SETTINGS)}>
              GitHub 이메일 설정 열기
              <ExternalLink aria-hidden />
            </Button>
          </div>
        )}
      </section>

      <form className={styles.form} noValidate aria-busy={save.isPending} onSubmit={submit}>
        <section aria-labelledby={field('content')} className={styles.section}>
          <h2 id={field('content')} className={styles.sectionTitle}>
            소개
          </h2>
          <div className={styles.field}>
            <label htmlFor={field('intro')} className={styles.label}>
              한 줄 소개 <span aria-hidden>*</span>
              <span className="sr-only">(필수)</span>
            </label>
            <input
              id={field('intro')}
              className={styles.input}
              placeholder="예: 팀 협업을 GitHub 이슈와 채팅으로 묶은 웹앱"
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
                max={POST.intro.max}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor={field('body')} className={styles.label}>
              본문{optional}
            </label>
            <textarea
              id={field('body')}
              className={styles.textarea}
              rows={10}
              placeholder="어떤 문제를 풀었는지, 내가 맡은 일, 데모와 배운 점을 적어 주세요."
              aria-invalid={errors.body ? true : undefined}
              aria-describedby={describe(
                field('body-hint'),
                field('body-count'),
                errors.body && errorId('body'),
              )}
              {...form.register('body')}
            />
            <p id={field('body-hint')} className={styles.hint}>
              마크다운은 쓸 수 없어요. 줄바꿈과 링크만 그대로 보여요.
            </p>
            <div className={styles.fieldFoot}>
              {errors.body && (
                <p id={errorId('body')} className={styles.error}>
                  {errors.body.message}
                </p>
              )}
              <CharCounter
                id={field('body-count')}
                count={countChars(watched.body ?? '')}
                max={POST.bodyMax}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby={field('photos')} className={styles.section}>
          <h2 id={field('photos')} className={styles.sectionTitle}>
            사진{optional}
          </h2>
          <ImageUploader uploader={uploader} label="스크린샷·데모 사진" reorderable />
          {photoWait && !uploader.allDone && (
            <p className={styles.error} role="alert">
              사진이 모두 올라가야 게시할 수 있어요. 실패한 사진은 다시 올리거나 빼 주세요.
            </p>
          )}
        </section>

        <section aria-labelledby={field('more')} className={styles.section}>
          <h2 id={field('more')} className={styles.sectionTitle}>
            추가 정보{optional}
          </h2>

          <div className={styles.field}>
            <label htmlFor={field('role')} className={styles.label}>
              내 역할
            </label>
            <input
              id={field('role')}
              className={styles.input}
              placeholder="예: 프론트엔드, 채팅 기능 담당"
              aria-invalid={errors.myRole ? true : undefined}
              aria-describedby={describe(field('role-count'), errors.myRole && errorId('role'))}
              {...form.register('myRole')}
            />
            <div className={styles.fieldFoot}>
              {errors.myRole && (
                <p id={errorId('role')} className={styles.error}>
                  {errors.myRole.message}
                </p>
              )}
              <CharCounter
                id={field('role-count')}
                count={countChars(watched.myRole ?? '')}
                max={POST.roleMax}
              />
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>데모 링크</legend>
            <p className={styles.hint}>https 주소만, {POST.demoLinksMax}개까지 넣을 수 있어요.</p>
            {links.fields.map((item, index) => {
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
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => links.remove(index)}
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">데모 링크 {index + 1} 빼기</span>
                  </button>
                  {linkError && (
                    <p id={`${inputId}-error`} className={styles.linkError}>
                      {linkError.message}
                    </p>
                  )}
                </div>
              );
            })}
            {links.fields.length < POST.demoLinksMax && (
              <Button variant="outline" onClick={() => links.append({ url: '' })}>
                <Plus aria-hidden />
                링크 추가
              </Button>
            )}
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>진행 기간</legend>
            <div className={styles.period}>
              <div className={styles.field}>
                <label htmlFor={field('start')} className={styles.subLabel}>
                  시작한 달
                </label>
                <input
                  id={field('start')}
                  type="month"
                  className={styles.input}
                  aria-invalid={errors.periodStart ? true : undefined}
                  aria-describedby={errors.periodStart ? errorId('start') : undefined}
                  {...form.register('periodStart')}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={field('end')} className={styles.subLabel}>
                  끝난 달
                </label>
                <input
                  id={field('end')}
                  type="month"
                  className={styles.input}
                  aria-invalid={errors.periodEnd ? true : undefined}
                  aria-describedby={describe(field('end-hint'), errors.periodEnd && errorId('end'))}
                  {...form.register('periodEnd')}
                />
              </div>
            </div>
            <p id={field('end-hint')} className={styles.hint}>
              아직 진행 중이면 끝난 달은 비워 두세요.
            </p>
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

          <div className={styles.field}>
            <label htmlFor={field('team')} className={styles.label}>
              팀 규모
            </label>
            <div className={styles.suffixInput}>
              <input
                id={field('team')}
                type="number"
                inputMode="numeric"
                min={POST.teamSize.min}
                max={POST.teamSize.max}
                className={styles.input}
                aria-invalid={errors.teamSize ? true : undefined}
                aria-describedby={errors.teamSize ? errorId('team') : undefined}
                {...form.register('teamSize')}
              />
              <span aria-hidden>명</span>
            </div>
            {errors.teamSize && (
              <p id={errorId('team')} className={styles.error}>
                {errors.teamSize.message}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHead}>
              <p className={styles.label} id={field('tags')}>
                태그
              </p>
              <Button
                variant="soft"
                aria-describedby={field('tags')}
                onClick={() => tagSheet.open()}
              >
                <Plus aria-hidden />
                {tags.length > 0 ? '바꾸기' : '고르기'}
              </Button>
            </div>
            {tags.length === 0 ? (
              <p className={styles.hint}>기술 스택 태그를 {POST.tagsMax}개까지 고를 수 있어요.</p>
            ) : (
              <ul className={styles.tags} aria-labelledby={field('tags')}>
                {tags.map((tag) => (
                  <li key={tag}>
                    <button type="button" className={styles.tag} onClick={() => removeTag(tag)}>
                      <span aria-hidden>{tag}</span>
                      <X aria-hidden className={styles.metaIcon} />
                      <span className="sr-only">{tag} 빼기</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
          <Button type="submit" block aria-disabled={save.isPending}>
            {save.isPending ? '저장하는 중…' : creating ? '게시하기' : '수정 완료'}
          </Button>
        </div>
      </form>

      <TechTagSheet value={tags} max={POST.tagsMax} onSave={saveTags} />
    </>
  );
}
