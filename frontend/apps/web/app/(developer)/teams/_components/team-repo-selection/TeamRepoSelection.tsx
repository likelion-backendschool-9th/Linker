'use client';

// real reuse: installed repo selection in setup and team settings
import styles from '@/features/teams/team-ui.module.css';
import type { SetupRepo } from '../../_lib/setup-queries';

export function TeamRepoSelection({
  repos,
  selected,
  onChange,
}: {
  repos: SetupRepo[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <fieldset className={styles.section}>
      <legend className={styles.label}>연결할 레포</legend>
      {repos.length ? (
        repos.map((repo) => (
          <label className={styles.choice} key={repo.id}>
            <input
              type="checkbox"
              checked={selected.includes(repo.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, repo.id]
                    : selected.filter((id) => id !== repo.id),
                )
              }
            />
            <span className={styles.body}>
              {repo.fullName}
              {repo.private && <span className={styles.meta}>비공개 레포</span>}
            </span>
          </label>
        ))
      ) : (
        <p className={styles.description}>연결할 수 있는 레포가 없어요.</p>
      )}
    </fieldset>
  );
}
