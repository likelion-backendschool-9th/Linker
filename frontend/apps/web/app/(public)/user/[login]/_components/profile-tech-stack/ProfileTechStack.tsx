'use client';

import styles from '../profile.module.css';
import { useFittingChips } from './hook';

/**
 * Tech stack chips on one line (Figma 121:1188). Chips that don't fit collapse into a "+N" chip;
 * screen readers still get the hidden names.
 */
export function ProfileTechStack({ tags }: { tags: string[] }) {
  const { rowRef, measureRef, visible } = useFittingChips(tags.length);
  const hidden = tags.slice(visible);

  return (
    <div className={styles.stackWrap}>
      <ul ref={rowRef} className={styles.stackRow} aria-label="기술 스택">
        {tags.slice(0, visible).map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
        {hidden.length > 0 && (
          <li>
            <span aria-hidden>+{hidden.length}</span>
            <span className="sr-only">{`외 ${hidden.length}개: ${hidden.join(', ')}`}</span>
          </li>
        )}
      </ul>
      {/* Off-screen copy used only for measuring chip widths */}
      <ul ref={measureRef} className={`${styles.stackRow} ${styles.stackMeasure}`} aria-hidden>
        {tags.map((tag) => (
          <li key={tag} data-chip>
            {tag}
          </li>
        ))}
        {tags.map((_, i) => (
          <li key={`more-${i + 1}`} data-more={i + 1}>
            +{i + 1}
          </li>
        ))}
      </ul>
    </div>
  );
}
