'use client';

import { CheckCircleLinearIcon } from '@solar-icons/static/linear/check-circle';
import { MagnifierLinearIcon } from '@solar-icons/static/linear/magnifier';

import { useLoaderPresence } from '@/components/ui/page-loading';

import { STEPS } from '../post-create/hook';
import styles from './PostWritePageSkeleton.module.css';

/** Figma 999:1015 "22-스켈레톤" — step-1 chrome + repo name bone. */
export function PostWritePageSkeleton() {
  useLoaderPresence();

  return (
    <div className={styles.editor} aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <ol className={styles.steps} aria-label="작성 단계">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={index === 0 ? styles.stepItemReached : styles.stepItem}
            aria-current={index === 0 ? 'step' : undefined}
          >
            <span className="sr-only">
              {index + 1}. {label}
            </span>
          </li>
        ))}
      </ol>
      <section aria-labelledby="post-write-skeleton-title" className={styles.step}>
        <div className={styles.intro}>
          <h2 id="post-write-skeleton-title" className={styles.title}>
            저장소를 선택해 주세요
          </h2>
          <p className={styles.hint}>저장소의 기본적인 정보를 불러올 수 있습니다</p>
        </div>
        <div className={styles.search} aria-hidden>
          <span
            className={styles.searchIcon}
            dangerouslySetInnerHTML={{ __html: MagnifierLinearIcon }}
          />
          저장소 검색하기
        </div>
        <div className={styles.repo} aria-hidden>
          <span
            className={styles.check}
            dangerouslySetInnerHTML={{ __html: CheckCircleLinearIcon }}
          />
          <span className={styles.bone} />
        </div>
        <div className={styles.submitBar} aria-hidden>
          <button type="button" className={styles.cta} tabIndex={-1} disabled>
            다음
          </button>
        </div>
      </section>
    </div>
  );
}
