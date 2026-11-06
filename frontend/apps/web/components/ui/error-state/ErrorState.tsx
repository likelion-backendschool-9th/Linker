import { Button } from '../button';
import styles from '../state.module.css';

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

/** A region (or `error.tsx`) that failed to load, with a retry. Announced as an alert. */
export function ErrorState({
  title = '불러오지 못했어요',
  description = '잠시 후 다시 시도해 주세요.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={styles.state} role="alert">
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>
      {onRetry && (
        <div className={styles.action}>
          <Button variant="outline" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      )}
    </div>
  );
}
