import styles from './skip-link.module.css';

/** "본문 바로가기": first focusable element of every page, jumps to `main#main` (blueprint §6-1). */
export function SkipLink() {
  return (
    <a href="#main" className={styles.skip}>
      본문 바로가기
    </a>
  );
}
