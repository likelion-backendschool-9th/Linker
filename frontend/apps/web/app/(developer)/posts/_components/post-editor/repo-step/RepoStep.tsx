'use client';

// Own region: step 1 of 22, pick one public repo (POL-P-1, Figma 265:142)
import { CheckCircleLinearIcon } from '@solar-icons/static/linear/check-circle';
import { MagnifierLinearIcon } from '@solar-icons/static/linear/magnifier';

import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from './RepoStep.module.css';
import { useRepoStep } from './hook';

type RepoStepProps = {
  /** From 09's project-completion notice: narrows to that team's repos and preselects one */
  teamId: string | null;
  repoId: number | null;
  onSelect: (repoId: number) => void;
  onNext: (repoId: number) => void;
};

function repoName(fullName: string) {
  const slash = fullName.lastIndexOf('/');
  return slash >= 0 ? fullName.slice(slash + 1) : fullName;
}

export function RepoStep({ teamId, repoId, onSelect, onNext }: RepoStepProps) {
  const { id, text, setText, q, repos, items } = useRepoStep({
    teamId,
    repoId,
    onSelect,
  });
  const canNext = repoId !== null;

  return (
    <section aria-labelledby={`${id}-title`} className={styles.step}>
      <div className={styles.intro}>
        <h2 id={`${id}-title`} className={styles.title}>
          저장소를 선택해 주세요
        </h2>
        <p className={styles.hint}>저장소의 기본적인 정보를 불러올 수 있습니다</p>
      </div>

      <div className={styles.search}>
        <label htmlFor={`${id}-search`} className="sr-only">
          저장소 검색
        </label>
        <Icon svg={MagnifierLinearIcon} className={styles.searchIcon} />
        <input
          id={`${id}-search`}
          type="search"
          className={styles.searchInput}
          placeholder="저장소 검색하기"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
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
        <fieldset className={styles.fieldset}>
          <legend className="sr-only">레포 목록</legend>
          <ul className={styles.repos}>
            {items.map((repo) => {
              const selected = repoId === repo.repoId;
              const name = repoName(repo.fullName);
              return (
                <li key={repo.repoId}>
                  <label
                    className={styles.repo}
                    data-selected={selected || undefined}
                    data-disabled={repo.alreadyPosted || undefined}
                  >
                    <input
                      type="radio"
                      name="repo"
                      className={styles.control}
                      checked={selected}
                      disabled={repo.alreadyPosted}
                      onChange={() => onSelect(repo.repoId)}
                    />
                    <Icon svg={CheckCircleLinearIcon} className={styles.check} />
                    <span className={styles.repoName} title={repo.fullName}>
                      {name}
                      {repo.alreadyPosted && <span className="sr-only"> (이미 피드에 올린 레포)</span>}
                    </span>
                    {repo.isFork && <span className={styles.fork}>포크</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      <div className={styles.submitBar}>
        <button
          type="button"
          className={styles.cta}
          disabled={!canNext}
          onClick={() => {
            if (repoId !== null) onNext(repoId);
          }}
        >
          다음
        </button>
      </div>
    </section>
  );
}
