'use client';

// Own region: `[Included]` README toggle, collapsed by default (POL-P-3)
import { ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from '../post-detail/PostDetail.module.css';
import { useReadmeSection } from './hook';

/** Fetched only when opened; the server caches it for an hour and strips scripts and HTML */
export function ReadmeSection({ postId }: { postId: string }) {
  const { bodyId, open, toggle, readme, openExternal } = useReadmeSection(postId);

  return (
    <section className={styles.readme}>
      <h3 className={styles.readmeHeading}>
        <button
          type="button"
          className={styles.readmeToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
        >
          README
          <ChevronDown aria-hidden className={open ? styles.chevronOpen : styles.chevron} />
        </button>
      </h3>
      <div id={bodyId} hidden={!open}>
        {open &&
          (readme.isPending ? (
            <Skeleton count={2} />
          ) : readme.isError ? (
            <ErrorState title="README를 불러오지 못했어요" onRetry={() => void readme.refetch()} />
          ) : (
            <div className={styles.markdown}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => {
                        if (!href?.startsWith('https://')) return;
                        event.preventDefault();
                        openExternal(href);
                      }}
                    >
                      {children}
                      <span className="sr-only"> (새 창)</span>
                    </a>
                  ),
                  img: ({ src, alt }) => (
                    // eslint-disable-next-line @next/next/no-img-element -- external images inside user markdown (blueprint §10-3)
                    <img
                      src={typeof src === 'string' ? src : undefined}
                      alt={alt ?? ''}
                      loading="lazy"
                      decoding="async"
                    />
                  ),
                }}
              >
                {readme.data.markdown}
              </ReactMarkdown>
            </div>
          ))}
      </div>
    </section>
  );
}
