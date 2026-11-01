'use client';

// client boundary: explicit UI-only result previews; query params never authorize an installation
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import styles from '@/features/teams/team-ui.module.css';
import { OUTCOME_LABELS, SETUP_OUTCOMES, TeamSetupOutcome } from './team-setup-outcome';

export function TeamCallbackView() {
  const [preview, setPreview] = useQueryState(
    'preview',
    parseAsStringLiteral(SETUP_OUTCOMES).withDefault('UNVERIFIED'),
  );
  return (
    <div className={styles.stack}>
      <TeamSetupOutcome state={preview} />
      <details className={styles.soft}>
        <summary>상태별 화면 미리보기</summary>
        <p className={styles.description}>
          실제 설치 결과가 아니에요. 서버 검증은 실행되지 않아요.
        </p>
        <div className={styles.field}>
          <label htmlFor="setup-result-preview">확인할 화면</label>
          <select
            id="setup-result-preview"
            className={styles.select}
            value={preview}
            onChange={(event) => void setPreview(event.target.value as typeof preview)}
          >
            {SETUP_OUTCOMES.map((value) => (
              <option key={value} value={value}>
                {OUTCOME_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </details>
    </div>
  );
}
