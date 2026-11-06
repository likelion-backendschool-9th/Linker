'use client';

import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from '../issue-create/IssueCreate.module.css';
import { SOURCE_HINT, useRepoTemplateStep, type RepoTemplateStepProps } from './hook';

export function RepoTemplateStep(props: RepoTemplateStepProps) {
  const {
    repos,
    writable,
    repo,
    template,
    missing,
    templates,
    id,
    groups,
    pickRepo,
    pickTemplate,
    submit,
  } = useRepoTemplateStep(props);
  const { teamId } = props;

  if (repos.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">레포를 불러오고 있어요.</p>
        <Skeleton variant="line" count={2} />
      </div>
    );
  }
  if (repos.isError) return <ErrorState onRetry={() => void repos.refetch()} />;
  if (writable.length === 0) {
    return (
      <EmptyState
        title="이슈를 만들 수 있는 레포가 없어요."
        description="이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요."
        action={
          <Button variant="outline" asChild>
            <Link href={`/teams/${teamId}/issues` as Route}>이슈 목록으로</Link>
          </Button>
        }
      />
    );
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <fieldset
        className={styles.fieldset}
        aria-describedby={missing === 'repo' ? `${id}-repo-error` : undefined}
      >
        <legend className={styles.legend}>
          레포 <span aria-hidden>*</span>
          <span className="sr-only">(필수)</span>
        </legend>
        <div className={styles.options}>
          {repos.data.items.map((item) => (
            <label key={item.id} className={styles.option}>
              <input
                type="radio"
                name={`${id}-repo`}
                className={styles.control}
                checked={repo === item.id}
                disabled={!item.canWrite}
                onChange={() => pickRepo(item.id)}
              />
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>{item.name}</span>
                <span className={styles.optionHint}>
                  {item.canWrite ? item.fullName : `${item.fullName} · 쓰기 권한 없음`}
                </span>
              </span>
            </label>
          ))}
        </div>
        {missing === 'repo' && (
          <p id={`${id}-repo-error`} className={styles.error}>
            레포를 골라 주세요.
          </p>
        )}
      </fieldset>

      {repo !== null && (
        <fieldset
          className={styles.fieldset}
          aria-describedby={missing === 'template' ? `${id}-template-error` : undefined}
          aria-busy={templates.isPending}
        >
          <legend className={styles.legend}>
            템플릿 <span aria-hidden>*</span>
            <span className="sr-only">(필수)</span>
          </legend>
          {templates.isError ? (
            <ErrorState
              title="템플릿을 불러오지 못했어요"
              onRetry={() => void templates.refetch()}
            />
          ) : templates.isPending ? (
            <Skeleton variant="line" count={3} />
          ) : (
            groups.map((group) => (
              <div key={group.title} className={styles.group}>
                <p className={styles.groupTitle}>{group.title}</p>
                <div className={styles.options}>
                  {group.items.map((item) => (
                    <label key={item.key} className={styles.option}>
                      <input
                        type="radio"
                        name={`${id}-template`}
                        className={styles.control}
                        checked={template === item.key}
                        onChange={() => pickTemplate(item.key)}
                      />
                      <span className={styles.optionText}>
                        <span className={styles.optionTitle}>{item.name}</span>
                        <span className={styles.optionHint}>
                          {SOURCE_HINT[item.source]} · {item.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
          {missing === 'template' && (
            <p id={`${id}-template-error`} className={styles.error}>
              템플릿을 골라 주세요.
            </p>
          )}
        </fieldset>
      )}

      <div className={styles.actions}>
        <Button type="submit">다음</Button>
      </div>
    </form>
  );
}
