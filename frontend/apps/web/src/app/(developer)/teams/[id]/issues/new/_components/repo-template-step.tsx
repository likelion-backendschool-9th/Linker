'use client';

// Own region: step 1, choose a writable repo and a template (07 TODO 13)
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

import { createReposOptions, templatesOptions, type TemplateSummary } from '../_lib/create-queries';
import styles from './issue-create.module.css';

type RepoTemplateStepProps = {
  teamId: string;
  /** Selection kept in the URL, so back from step 2 shows it again */
  repoId: number | null;
  templateKey: string | null;
  /** Writes the choice to the URL (replace), so back from step 2 shows it again */
  onSelect: (repoId: number | null, templateKey: string | null) => void;
  onNext: (repoId: number, templateKey: string) => void;
};

const SOURCE_HINT: Record<TemplateSummary['source'], string> = {
  REPO: '레포 템플릿',
  ORG: '조직 템플릿',
  DEFAULT: '기본 템플릿',
};

export function RepoTemplateStep({
  teamId,
  repoId,
  templateKey,
  onSelect,
  onNext,
}: RepoTemplateStepProps) {
  const repos = useQuery(createReposOptions(teamId));
  const writable = repos.data?.items.filter((repo) => repo.canWrite) ?? [];
  const [picked, setRepo] = useState<number | null>(repoId);
  // With one writable repo it's chosen already, also when the list arrives after the first render
  const repo = picked ?? (writable.length === 1 ? writable[0]!.id : null);
  const [template, setTemplate] = useState<string | null>(templateKey);
  const [missing, setMissing] = useState<'repo' | 'template' | null>(null);
  const templates = useQuery({ ...templatesOptions(teamId, repo ?? 0), enabled: repo !== null });
  const id = useId();

  if (repos.isPending) {
    return (
      <LoadingIndicator label="레포를 불러오고 있어요." variant="inline">
        <Skeleton variant="line" count={2} />
      </LoadingIndicator>
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

  // Repo templates on top, the 3 defaults below (POL-I-1)
  const items = templates.data?.items ?? [];
  const groups = [
    { title: '레포 템플릿', items: items.filter((item) => item.source !== 'DEFAULT') },
    { title: '기본 템플릿', items: items.filter((item) => item.source === 'DEFAULT') },
  ].filter((group) => group.items.length > 0);

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (repo === null) return setMissing('repo');
        if (!template || !items.some((item) => item.key === template))
          return setMissing('template');
        onNext(repo, template);
      }}
    >
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
                onChange={() => {
                  setRepo(item.id);
                  setTemplate(null);
                  setMissing(null);
                  onSelect(item.id, null);
                }}
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

      {repo !== null && templates.isPending && (
        <p role="status" className="sr-only">불러오는 중…</p>
      )}
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
            <LoadingIndicator label="불러오는 중…" labelHidden variant="inline" announce={false}>
              <Skeleton variant="line" count={3} />
            </LoadingIndicator>
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
                        onChange={() => {
                          setTemplate(item.key);
                          setMissing(null);
                          onSelect(repo, item.key);
                        }}
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
