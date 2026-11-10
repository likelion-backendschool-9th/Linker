'use client';

import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from './RepoTemplateStep.module.css';
import { useRepoTemplateStep, type RepoTemplateStepProps } from './hook';

/** Step 1 of 13: repo, then templates. Field chrome follows Figma 13's input (200:806). */
export function RepoTemplateStep(props: RepoTemplateStepProps) {
  const { repos, writable, repo, template, templates, id, groups, pickRepo, pickTemplate, submit } =
    useRepoTemplateStep(props);
  const ready = repo !== null && template !== null;

  if (repos.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">레포를 불러오고 있어요.</p>
        <Skeleton variant="line" count={2} />
      </div>
    );
  }
  if (repos.isError) return <ErrorState onRetry={() => void repos.refetch()} />;

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <fieldset className={styles.field}>
        <legend className={styles.legend}>
          레포
          <span className={styles.dot} aria-hidden />
          <span className="sr-only">(필수)</span>
        </legend>
        <div className={styles.options}>
          {writable.map((item) => (
            <label key={item.id} className={styles.choice}>
              <input
                type="radio"
                name={`${id}-repo`}
                className={styles.control}
                checked={repo === item.id}
                onChange={() => pickRepo(item.id)}
              />
              <span>{item.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {repo !== null && (
        <fieldset className={styles.field} aria-busy={templates.isPending}>
          <legend className={styles.legend}>
            템플릿
            <span className={styles.dot} aria-hidden />
            <span className="sr-only">(필수)</span>
          </legend>
          {templates.isError ? (
            <ErrorState title="템플릿을 불러오지 못했어요" onRetry={() => void templates.refetch()} />
          ) : templates.isPending ? (
            <Skeleton variant="line" count={3} />
          ) : (
            <div className={styles.options}>
              {groups.flatMap((group) =>
                group.items.map((item) => (
                  <label key={item.key} className={styles.choice}>
                    <input
                      type="radio"
                      name={`${id}-template`}
                      className={styles.control}
                      checked={template === item.key}
                      onChange={() => pickTemplate(item.key)}
                    />
                    <span>{item.name}</span>
                  </label>
                )),
              )}
            </div>
          )}
        </fieldset>
      )}

      <button type="submit" className={styles.next} aria-disabled={!ready}>
        다음
      </button>
    </form>
  );
}
