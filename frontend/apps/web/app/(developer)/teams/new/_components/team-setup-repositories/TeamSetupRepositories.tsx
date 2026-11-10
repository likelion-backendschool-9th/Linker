'use client';

// Region: page-08 repository search and initial connection, separate from settings.
import { MagnifierLinearIcon } from '@solar-icons/static/linear/magnifier';
import { Icon } from '@/components/ui/icon';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { useTeamSetupRepositories } from './hook';
import styles from './TeamSetupRepositories.module.css';

type Props = {
  teamId: number | null;
  selected: number[];
  onChange: (ids: number[]) => void;
  onNext: () => void;
  openExternal: (url: string) => void;
};

export function TeamSetupRepositories({ teamId, selected, onChange, onNext, openExternal }: Props) {
  const { search, setSearch, repos, filtered, validSelected, save } = useTeamSetupRepositories(
    teamId,
    selected,
    onNext,
  );
  const ready = repos.isSuccess && !repos.isFetching && validSelected.length > 0 && !save.isPending;
  return (
    <section className={styles.repositories} aria-labelledby="setup-repos-title">
      <div className={styles.content}>
        <div className={styles.heading}>
          <h2 id="setup-repos-title">팀과 함께 할 저장소를 선택하세요</h2>
          <p>저장소들을 선택해 주세요</p>
        </div>
        <label className={styles.search}>
          <Icon svg={MagnifierLinearIcon} className={styles.searchIcon} />
          <span className="sr-only">저장소 검색</span>
          <input
            type="search"
            placeholder="저장소 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {!teamId ? (
          <EmptyState title="GitHub 조직을 먼저 연결해 주세요." />
        ) : repos.isPending ? (
          <Skeleton variant="line" count={3} />
        ) : repos.isError ? (
          <ErrorState onRetry={() => void repos.refetch()} />
        ) : (
          <>
            <fieldset className={styles.choices} disabled={save.isPending}>
              <legend className="sr-only">연결할 저장소</legend>
              {filtered.map((repo) => (
                <label className={styles.choice} key={repo.id}>
                  <input
                    className={styles.checkboxInput}
                    type="checkbox"
                    checked={validSelected.includes(repo.id)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...validSelected, repo.id]
                          : validSelected.filter((id) => id !== repo.id),
                      )
                    }
                  />
                  <span className={styles.checkbox} aria-hidden="true" />
                  <span className={styles.repoName}>{repo.name}</span>
                </label>
              ))}
            </fieldset>
            {!filtered.length && (
              <div>
                <EmptyState
                  title={search.trim() ? '검색 결과가 없어요.' : '연결할 수 있는 레포가 없어요.'}
                />
                {repos.data.settingsUrl && (
                  <button
                    className={styles.access}
                    type="button"
                    onClick={() => openExternal(repos.data.settingsUrl)}
                  >
                    GitHub에서 접근 허용하기
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {save.error && <ErrorState title={save.error.message} />}
      </div>
      <button
        type="button"
        className={styles.next}
        disabled={!ready}
        aria-busy={save.isPending}
        onClick={() => {
          if (ready) save.mutate();
        }}
      >
        다음
      </button>
    </section>
  );
}
