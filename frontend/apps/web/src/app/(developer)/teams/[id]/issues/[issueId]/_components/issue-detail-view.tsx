'use client';

// Client boundary: detail query, the four sheets and their saves, permission toasts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/ui/relative-time';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { useViewer } from '@/lib/auth/viewer-context';
import { formatDate } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { IssueAssigneeSheet } from '../../../_components/issue-sheets/issue-assignee-sheet';
import { IssueLabelSheet } from '../../../_components/issue-sheets/issue-label-sheet';
import { IssueScheduleSheet } from '../../../_components/issue-sheets/issue-schedule-sheet';
import { IssueStatusSheet } from '../../../_components/issue-sheets/issue-status-sheet';
import {
  assigneeCandidatesOptions,
  issueDetailKeys,
  issueDetailOptions,
  labelOptionsOptions,
  saveAssignees,
  saveLabels,
  saveSchedule,
  saveStatus,
  type IssueDetail,
} from '../../../_lib/issue-detail-queries';
import { issueKeys } from '../../../_lib/issue-queries';
import { ISSUE_STATUS_LABELS } from '../../../_lib/issue-status';
import styles from './issue-detail-view.module.css';

/** 04 ch. 12 "No GitHub permission" */
const NO_PERMISSION = '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.';

/** 12 Issue detail (07 TODO 12). Data comes from the server-prefetched detail query. */
export function IssueDetailView({ teamId, issueId }: { teamId: string; issueId: string }) {
  const viewer = useViewer();
  const client = useQueryClient();
  const detail = useQuery(issueDetailOptions(teamId, issueId));
  const openExternal = useOpenExternal();
  const sheets = {
    assignees: useOverlay('issue-assignees'),
    labels: useOverlay('issue-labels'),
    schedule: useOverlay('issue-schedule'),
    status: useOverlay('issue-status'),
  };

  // The page only renders once the server fetched it, so `data` is there; refetches keep it
  const issue = detail.data;
  if (!issue) return null;

  const canWrite = issue.canWrite && viewer.status !== 'SUSPENDED';

  /** After a save: show the saved value now, then refetch the detail and every list of this team */
  async function applied(patch: Partial<IssueDetail>) {
    client.setQueryData<IssueDetail>(issueDetailKeys.detail(teamId, issueId), (old) =>
      old ? { ...old, ...patch } : old,
    );
    await client.invalidateQueries({ queryKey: issueKeys.team(teamId) });
  }

  /** Without repo write permission the button stays focusable and says why (POL-I-2, 04 ch. 7) */
  function edit(open: () => void) {
    return () => {
      if (!canWrite) {
        toast(
          viewer.status === 'SUSPENDED' ? '이용이 제한된 동안에는 바꿀 수 없어요.' : NO_PERMISSION,
          {
            tone: 'alert',
          },
        );
        return;
      }
      open();
    };
  }

  const editProps = (label: string, open: () => void): ComponentProps<typeof Button> => ({
    variant: 'outline',
    'aria-disabled': !canWrite,
    onClick: edit(open),
    children: label,
  });

  return (
    <>
      <Link href={`/teams/${teamId}/issues` as Route} className={styles.back}>
        <ArrowLeft aria-hidden />
        이슈 목록
      </Link>

      <article aria-labelledby="issue-title" className={styles.article}>
        <div className={styles.head}>
          <p className={styles.repo}>
            {issue.repoName} #{issue.number}
          </p>
          <h2 id="issue-title" className={styles.title}>
            {issue.title}
          </h2>
          <p className={styles.byline}>
            <Image
              src={issue.author.avatarUrl}
              alt=""
              width={24}
              height={24}
              sizes="24px"
              className={styles.avatar}
            />
            <span>
              {issue.author.name}님이 작성 · <RelativeTime value={issue.createdAt} />
            </span>
          </p>
          <Button variant="soft" onClick={() => openExternal(issue.githubUrl)}>
            <ExternalLink aria-hidden />
            GitHub에서 열기
            <span className="sr-only"> (새 창)</span>
          </Button>
        </div>

        {issue.syncFailed && (
          <p className={styles.warning} role="status">
            일정이 GitHub에 반영되지 않았어요
          </p>
        )}
        {!issue.canWrite && (
          <p className={styles.notice}>
            이 레포에 쓸 권한이 없어 보기만 할 수 있어요. 레포 관리자에게 권한을 요청해 주세요.
          </p>
        )}

        <section aria-labelledby="issue-fields" className={styles.section}>
          <h3 id="issue-fields" className="sr-only">
            이슈 정보
          </h3>
          <dl className={styles.fields}>
            <div className={styles.field}>
              <dt className={styles.term}>상태</dt>
              <dd className={styles.value}>
                <span className={styles.status}>{ISSUE_STATUS_LABELS[issue.status]}</span>
                {issue.state === 'CLOSED' && <span className={styles.meta}>닫힌 이슈</span>}
              </dd>
              <dd className={styles.action}>
                <Button {...editProps('상태 바꾸기', () => sheets.status.open())} />
              </dd>
            </div>

            <div className={styles.field}>
              <dt className={styles.term}>담당자</dt>
              <dd className={styles.value}>
                {issue.assignees.length === 0 ? (
                  <span className={styles.meta}>담당자 없음</span>
                ) : (
                  <ul className={styles.people}>
                    {issue.assignees.map((user) => (
                      <li key={user.id} className={styles.person}>
                        <Image
                          src={user.avatarUrl}
                          alt=""
                          width={24}
                          height={24}
                          sizes="24px"
                          className={styles.avatar}
                        />
                        {user.name}
                        {!user.inTeam && <span className={styles.meta}>팀 밖 사용자</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
              <dd className={styles.action}>
                <Button {...editProps('담당자 변경', () => sheets.assignees.open())} />
              </dd>
            </div>

            <div className={styles.field}>
              <dt className={styles.term}>라벨</dt>
              <dd className={styles.value}>
                {issue.labels.length === 0 ? (
                  <span className={styles.meta}>라벨 없음</span>
                ) : (
                  <ul className={styles.labels}>
                    {issue.labels.map((label) => (
                      <li key={label.name} className={styles.label}>
                        {/* GitHub's label color is data, so it's inline; the name carries the meaning */}
                        <span
                          className={styles.swatch}
                          style={{ backgroundColor: `#${label.color.replace(/^#/, '')}` }}
                          aria-hidden
                        />
                        {label.name}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
              <dd className={styles.action}>
                <Button {...editProps('라벨 변경', () => sheets.labels.open())} />
              </dd>
            </div>

            <div className={styles.field}>
              <dt className={styles.term}>기간</dt>
              <dd className={styles.value}>
                {!issue.startDate && !issue.dueDate ? (
                  <span className={styles.meta}>일정 없음</span>
                ) : (
                  <span className={issue.overdue ? styles.overdue : undefined}>
                    {issue.startDate ? (
                      <time dateTime={issue.startDate}>{formatDate(issue.startDate)}</time>
                    ) : (
                      '시작일 없음'
                    )}
                    {' ~ '}
                    {issue.dueDate ? (
                      <time dateTime={issue.dueDate}>{formatDate(issue.dueDate)}</time>
                    ) : (
                      '마감일 없음'
                    )}
                    {issue.overdue && ' · 마감 지남'}
                  </span>
                )}
              </dd>
              <dd className={styles.action}>
                <Button {...editProps('일정 변경', () => sheets.schedule.open())} />
              </dd>
            </div>

            {issue.subIssues.total > 0 && (
              <div className={styles.field}>
                <dt className={styles.term}>하위 이슈</dt>
                <dd className={styles.value}>
                  하위 {issue.subIssues.total}개 중 {issue.subIssues.done}개 완료
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section aria-labelledby="issue-body" className={styles.section}>
          <h3 id="issue-body" className={styles.sectionTitle}>
            내용
          </h3>
          {issue.body.trim() ? (
            <IssueMarkdown body={issue.body} onOpenLink={openExternal} />
          ) : (
            <p className={styles.meta}>내용이 없어요.</p>
          )}
        </section>
      </article>

      <IssueStatusSheet
        value={issue.status}
        onSave={async (status) => {
          const saved = await saveStatus(teamId, issueId, status);
          await applied(saved);
          toast('상태를 바꿨어요.');
        }}
      />
      <IssueAssigneeSheet
        value={issue.assignees}
        candidates={assigneeCandidatesOptions(teamId, issueId)}
        onSave={async (userIds) => {
          const saved = await saveAssignees(teamId, issueId, userIds);
          await applied(saved);
          toast('담당자를 바꿨어요.');
        }}
      />
      <IssueLabelSheet
        value={issue.labels}
        options={labelOptionsOptions(teamId, issueId)}
        onSave={async (labels) => {
          const saved = await saveLabels(teamId, issueId, labels);
          await applied(saved);
          toast('라벨을 바꿨어요.');
        }}
      />
      <IssueScheduleSheet
        value={{ startDate: issue.startDate, dueDate: issue.dueDate }}
        onSave={async (schedule) => {
          const saved = await saveSchedule(teamId, issueId, schedule);
          await applied(saved);
          toast('일정을 바꿨어요.');
        }}
      />
    </>
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
