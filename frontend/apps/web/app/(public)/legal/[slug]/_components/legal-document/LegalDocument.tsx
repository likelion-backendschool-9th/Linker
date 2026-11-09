import type { Route } from 'next';
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

type Heading = { depth: 2 | 3; title: string };

/** Clause headings only. The markdown h1 repeats the stack-header title, so it is not a section. */
function readHeadings(markdown: string): Heading[] {
  return markdown.split('\n').flatMap((line) => {
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) return [];
    const depth = match[1]!.length;
    if (depth !== 2 && depth !== 3) return [];
    return [{ depth, title: match[2]!.replace(/[`*_]/g, '') }];
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
  const isTerms = document.slug === 'terms';
  let headingIndex = 0;
  const components: Components = {
    h1: () => null,
    h2: ({ children }) => <h2 id={`legal-section-${headingIndex++}`}>{children}</h2>,
    h3: ({ children }) => <h3 id={`legal-section-${headingIndex++}`}>{children}</h3>,
    a: ({ href, children }) => {
      if (href?.startsWith('/')) return <Link href={href as Route}>{children}</Link>;
      return <a href={href}>{children}</a>;
    },
  };

  return (
    <div className={`${styles.layout} ${isTerms ? styles.termsLayout : ''}`}>
      {!isTerms && (
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
      )}

      <article className={styles.article}>
        {!isTerms && (
          <p className={styles.meta}>
            버전 {document.version} <span aria-hidden="true">·</span> 시행일 {document.effectiveDate}
          </p>
        )}

        {!isTerms && headings.length > 0 && (
          <nav className={styles.toc} aria-label="문서 목차">
            <h2>목차</h2>
            <ol>
              {headings.map((heading, index) => (
                <li
                  key={`${heading.title}-${index}`}
                  className={heading.depth === 3 ? styles.nested : undefined}
                >
                  <a href={`#legal-section-${index}`}>{heading.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className={`${styles.markdown} ${isTerms ? styles.termsMarkdown : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
            {document.body}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
