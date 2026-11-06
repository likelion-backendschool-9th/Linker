'use client';

// Own region: step 1 of 22, pick one public repo (POL-P-1)
import { GitFork, Search, Star } from 'lucide-react';

import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from '../post-editor.module.css';
import { useRepoStep } from './hook';

type RepoStepProps = {
  /** From 09's project-completion notice: narrows to that team's repos and preselects one */
  teamId: string | null;
  repoId: number | null;
  onSelect: (repoId: number) => void;
  onNext: (repoId: number) => void;
};

export function RepoStep({ teamId, repoId, onSelect, onNext }: RepoStepProps) {
  const { id, text, setText, q, repos, items, missing, setMissing } = useRepoStep({
    teamId,
    repoId,
    onSelect,
  });

  return (
    <section aria-labelledby={`${id}-title`} className={styles.step}>
      <h2 id={`${id}-title`} className={styles.sectionTitle}>
        어떤 레포를 소개할까요?
      </h2>
      <p className={styles.hint}>
        내 계정과 내가 속한 조직의 공개 레포만 고를 수 있어요. 레포 하나에 게시물 하나예요.
      </p>

      <div className={styles.field}>
        <label htmlFor={`${id}-search`} className={styles.label}>
          레포 검색
        </label>
        <div className={styles.search}>
          <Search aria-hidden className={styles.searchIcon} />
          <input
            id={`${id}-search`}
            type="search"
            className={styles.searchInput}
            placeholder="레포 이름으로 찾기"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>

      {repos.isPending ? (
        <div aria-busy="true">
          <p role="status" className="sr-only">
            레포를 불러오고 있어요.
          </p>
          <Skeleton count={3} />
        </div>
      ) : repos.isError ? (
        <ErrorState title="레포를 불러오지 못했어요" onRetry={() => void repos.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={q ? '검색한 레포가 없어요.' : '고를 수 있는 공개 레포가 없어요.'}
          description={
            q ? '다른 이름으로 찾아보세요.' : 'GitHub에서 레포를 공개로 바꾸면 여기에 보여요.'
          }
        />
      ) : (
        <fieldset
          className={styles.fieldset}
          aria-describedby={missing ? `${id}-error` : undefined}
        >
          <legend className="sr-only">레포 목록</legend>
          <ul className={styles.repos}>
            {items.map((repo) => (
              <li key={repo.repoId}>
                <label className={styles.repo}>
                  <input
                    type="radio"
                    name="repo"
                    className={styles.control}
                    checked={repoId === repo.repoId}
                    disabled={repo.alreadyPosted}
                    onChange={() => {
                      setMissing(false);
                      onSelect(repo.repoId);
                    }}
                  />
                  <span className={styles.repoText}>
                    <span className={styles.repoName}>{repo.fullName}</span>
                    <span className={styles.repoMeta}>
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
                    </span>
                  </span>
                  {repo.alreadyPosted && <span className={styles.posted}>이미 올린 레포</span>}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {missing && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          소개할 레포를 골라 주세요.
        </p>
      )}

      <div className={styles.submitBar}>
        <Button
          block
          onClick={() => {
            if (repoId === null) setMissing(true);
            else onNext(repoId);
          }}
        >
          다음
        </Button>
      </div>
    </section>
  );
}
