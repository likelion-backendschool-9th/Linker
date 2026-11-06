import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import styles from './LegalDocument.module.css';

type LegalDocumentData = {
  slug: string;
  title: string;
  version: string;
  effectiveDate: string;
  body: string;
};
type LegalDocumentLink = Pick<LegalDocumentData, 'slug' | 'title' | 'version' | 'effectiveDate'>;

function readHeadings(markdown: string) {
  return markdown.split('\n').flatMap((line) => {
    const match = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    return match ? [{ depth: match[1]!.length, title: match[2]!.replace(/[`*_]/g, '') }] : [];
  });
}

export function LegalDocument({
  document,
  documents,
}: {
  document: LegalDocumentData;
  documents: LegalDocumentLink[];
}) {
  const headings = readHeadings(document.body);
  let headingIndex = 0;
  const components: Components = {
    h1: ({ children }) => <h2 id={`legal-section-${headingIndex++}`}>{children}</h2>,
    h2: ({ children }) => <h3 id={`legal-section-${headingIndex++}`}>{children}</h3>,
    h3: ({ children }) => <h4 id={`legal-section-${headingIndex++}`}>{children}</h4>,
    a: ({ href, children }) => {
      if (href?.startsWith('/') || href?.startsWith('#')) {
        return <a href={href}>{children}</a>;
      }
      return <a href={href}>{children}</a>;
    },
  };

  return (
    <div className={styles.layout}>
      <nav className={styles.documentNav} aria-label="약관 및 정책 문서">
        <h2>문서</h2>
        <ul>
          {documents.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/legal/${item.slug}`}
                aria-current={item.slug === document.slug ? 'page' : undefined}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <article className={styles.article}>
        <p className={styles.meta}>
          버전 {document.version} <span aria-hidden="true">·</span> 시행일 {document.effectiveDate}
        </p>

        {headings.length > 0 && (
          <nav className={styles.toc} aria-label="문서 목차">
            <h2>목차</h2>
            <ol>
              {headings.map((heading, index) => (
                <li key={`${heading.title}-${index}`} className={styles[`depth${heading.depth}`]}>
                  <a href={`#legal-section-${index}`}>{heading.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className={styles.markdown}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={components}
          >
            {document.body}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
