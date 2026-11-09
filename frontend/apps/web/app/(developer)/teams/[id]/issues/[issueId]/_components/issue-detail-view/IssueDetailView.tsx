'use client';

// client boundary: four sheets through the URL (nuqs), detail and sub-issue queries, markdown body
import { ArrowRightUpLinearIcon } from '@solar-icons/static/linear/arrow-right-up';
import { useState, type CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { todayKst } from '@/lib/format/time';

import { boardStatusColorVar, ISSUE_STATUS_LABELS } from '../../../../../../_lib/issue-status';
import { IssueAssigneeSheet } from '../../../../_components/issue-sheets/issue-assignee-sheet';
import { IssueLabelSheet } from '../../../../_components/issue-sheets/issue-label-sheet';
import { IssueScheduleSheet } from '../../../../_components/issue-sheets/issue-schedule-sheet';
import type { SchedulePart } from '../../../../_components/issue-sheets/issue-schedule-sheet/hook';
import { IssueStatusSheet } from '../../../../_components/issue-sheets/issue-status-sheet';
import type { SubIssue } from '../../../../_lib/issue-detail-queries';
import { useIssueDetailView } from './hook';
import styles from './IssueDetailView.module.css';

/** Figma 12 date lines: "2025년 11월 2일" (the issue's KST calendar date) */
const longDate = (day: string) =>
  `${day.slice(0, 4)}년 ${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`;

/** Figma 12 sub-issue row: "11월 11일" */
const shortDate = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`;

function subDotColor(sub: SubIssue) {
  if (sub.statusColor) return sub.statusColor;
  return sub.state === 'CLOSED' ? 'GREEN' : 'BLUE';
}

function subOverdue(sub: SubIssue) {
  if (!sub.dueDate || sub.dueDate >= todayKst()) return false;
  if (sub.status) return sub.status !== 'DONE';
  return sub.state !== 'CLOSED';
}

/**
 * 12 Issue detail (07 TODO 12), Figma 12 (198:486): title with the GitHub link, `#번호 · 레포 · 작성자`,
 * the info card (each line opens its sheet), the body, then the view-only sub-issues. The four sheets use the
 * Figma 13 sheet frames (shared with 13 and 14).
 */
export function IssueDetailView({ teamId, issueId }: { teamId: string; issueId: string }) {
  const [schedulePart, setSchedulePart] = useState<SchedulePart>('start');
  const {
    issue,
    canWrite,
    openExternal,
    sheets,
    edit,
    subIssues,
    saveStatus,
    saveAssignees,
    saveLabels,
    saveSchedule,
    assigneeCandidates,
    labelOptions,
  } = useIssueDetailView(teamId, issueId);

  // The page only renders once the server fetched it, so `data` is there; refetches keep it
  if (!issue) return null;

  const overdue = issue.overdue && issue.status !== 'DONE';
  const sep = <span className={styles.separator} aria-hidden />;
  const empty = <span className="sr-only">없음</span>;

  return (
    <div className={styles.page}>
      <section className={styles.head}>
        <h2 className={styles.title}>
          {issue.title}
          <button
            type="button"
            className={styles.external}
            onClick={() => openExternal(issue.githubUrl)}
          >
            <span
              aria-hidden
              className={styles.icon}
              dangerouslySetInnerHTML={{ __html: ArrowRightUpLinearIcon }}
            />
            <span className="sr-only">GitHub에서 열기 (새 창)</span>
          </button>
        </h2>
        <p className={styles.meta}>
          <span>#{issue.number}</span>
          {sep}
          <span>{issue.repoName}</span>
          {sep}
          <span>{issue.author.name} 작성</span>
        </p>
        {issue.syncFailed && (
          <p role="status" className="sr-only">
            일정이 GitHub에 반영되지 않았어요
          </p>
        )}
      </section>

      <ul className={styles.card}>
        <li>
          <button
            type="button"
            className={styles.row}
            aria-haspopup="dialog"
            aria-disabled={!canWrite}
            onClick={edit(() => sheets.status.open())}
          >
            <span className={styles.term}>상태</span>{' '}
            <span
              className={styles.status}
              style={{ '--status-color': boardStatusColorVar(issue.statusColor) } as CSSProperties}
            >
              <span className={styles.dot} aria-hidden />
              {ISSUE_STATUS_LABELS[issue.status]}
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={styles.row}
            aria-haspopup="dialog"
            aria-disabled={!canWrite}
            onClick={edit(() => sheets.labels.open())}
          >
            <span className={styles.term}>라벨</span>{' '}
            <span className={styles.value}>
              {issue.labels.length === 0
                ? empty
                : issue.labels.map((label, index) => (
                    <span key={label.name} className={styles.item}>
                      {index > 0 && sep}
                      {label.name}
                    </span>
                  ))}
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={styles.row}
            aria-haspopup="dialog"
            aria-disabled={!canWrite}
            onClick={edit(() => sheets.assignees.open())}
          >
            <span className={styles.term}>담당자</span>{' '}
            <span className={styles.value}>
              {issue.assignees.length === 0
                ? empty
                : issue.assignees.map((user, index) => (
                    <span key={user.id} className={styles.item}>
                      {index > 0 && sep}
                      {user.name}
                      {!user.inTeam && (
                        <>
                          {sep}
                          <span>팀 밖 사용자</span>
                        </>
                      )}
                    </span>
                  ))}
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={styles.row}
            aria-haspopup="dialog"
            aria-disabled={!canWrite}
            onClick={edit(() => {
              setSchedulePart('start');
              sheets.schedule.open();
            })}
          >
            <span className={styles.term}>시작일</span>{' '}
            <span className={styles.value}>
              {issue.startDate ? (
                <time dateTime={issue.startDate}>{longDate(issue.startDate)}</time>
              ) : (
                empty
              )}
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={styles.row}
            aria-haspopup="dialog"
            aria-disabled={!canWrite}
            onClick={edit(() => {
              setSchedulePart('due');
              sheets.schedule.open();
            })}
          >
            <span className={styles.term}>마감일</span>{' '}
            <span className={styles.value} data-overdue={overdue}>
              {issue.dueDate ? (
                <time dateTime={issue.dueDate}>{longDate(issue.dueDate)}</time>
              ) : (
                empty
              )}
            </span>
          </button>
        </li>
      </ul>

      <section aria-labelledby="issue-body" className={styles.section}>
        <h3 id="issue-body" className={styles.sectionTitle}>
          이슈 본문
        </h3>
        <div className={styles.body}>
          <IssueMarkdown body={issue.body} onOpenLink={openExternal} />
        </div>
      </section>

      {issue.subIssues.total > 0 && (
        <section aria-labelledby="issue-sub" className={`${styles.section} ${styles.subSection}`}>
          <h3 id="issue-sub" className={styles.sectionTitle}>
            하위 이슈
            <span className={styles.progress}>
              {issue.subIssues.done}/{issue.subIssues.total} 완료
            </span>
          </h3>
          <ul className={styles.subList}>
            {subIssues.data?.items.map((sub) => {
              const overdue = subOverdue(sub);
              const statusLabel =
                sub.status && sub.status in ISSUE_STATUS_LABELS
                  ? ISSUE_STATUS_LABELS[sub.status as keyof typeof ISSUE_STATUS_LABELS]
                  : sub.state === 'CLOSED'
                    ? '완료'
                    : '열림';
              return (
                <li key={sub.number} className={styles.sub}>
                  <article className={styles.subCard}>
                    <div className={styles.subMain}>
                      <p className={styles.subTitle}>
                        {sub.title}
                        <span
                          className={styles.dot}
                          style={
                            { '--status-color': boardStatusColorVar(subDotColor(sub)) } as CSSProperties
                          }
                          aria-hidden
                        />
                        <span className="sr-only">{statusLabel}</span>
                      </p>
                      <p className={styles.subMeta}>
                        <span>#{sub.number}</span>
                        {sep}
                        <span>{issue.repoName}</span>
                        {sub.assigneeName ? (
                          <>
                            {sep}
                            <span>{sub.assigneeName}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {sub.dueDate ? (
                      <p className={styles.subDue} data-overdue={overdue || undefined}>
                        {shortDate(sub.dueDate)}
                      </p>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <IssueStatusSheet value={issue.status} onSave={saveStatus} />
      <IssueAssigneeSheet
        value={issue.assignees}
        candidates={assigneeCandidates}
        onSave={saveAssignees}
      />
      <IssueLabelSheet value={issue.labels} options={labelOptions} onSave={saveLabels} />
      <IssueScheduleSheet
        part={schedulePart}
        value={{ startDate: issue.startDate, dueDate: issue.dueDate }}
        onSave={saveSchedule}
      />
    </div>
  );
}

/**
 * Issue body. The server already sanitizes it; rehype-sanitize strips scripts again on the way in.
 * Links leave through the external-link confirm; images are the one `<img>` exception (blueprint §10-3).
 */
function IssueMarkdown({ body, onOpenLink }: { body: string; onOpenLink: (url: string) => void }) {
  return (
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
                onOpenLink(href);
              }}
            >
              {children}
              <span className="sr-only"> (새 창)</span>
            </a>
          ),
          // GitHub task lists ("- [ ]"): a read-only mark with its state in text instead of an unlabeled checkbox
          input: ({ type, checked }) =>
            type === 'checkbox' ? (
              <span className={styles.task} data-checked={checked === true}>
                <span aria-hidden>{checked ? '✓' : ''}</span>
                <span className="sr-only">{checked ? '완료: ' : '미완료: '}</span>
              </span>
            ) : null,
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
        {body}
      </ReactMarkdown>
    </div>
  );
}
