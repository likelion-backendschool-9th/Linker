'use client';

import { parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { formatDate } from '@/lib/format/time';

import type { IssueRow } from '../../../_lib/issue-queries';
import { ISSUE_STATUS_LABELS } from '../../../../../_lib/issue-status';
import { issuesOnDay, sameMonth, type Segment } from '../../_lib/calendar-grid';
import styles from './CalendarView.module.css';
import { dayLabel, dayNumber, MONTH_LANES, useCalendarView, WEEKDAYS } from './hook';

/** 15 Calendar (07 TODO 15): month/week, bars from start to due date, dots for due-only issues */
export function CalendarView({ teamId }: { teamId: string }) {
  const {
    params,
    anchor,
    today,
    weeks,
    calendar,
    members,
    daySheet,
    assigneeId,
    issues,
    layouts,
    title,
    goPrev,
    goNext,
    goToday,
    setView,
    setAssignee,
  } = useCalendarView(teamId);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <Button variant="soft" onClick={goPrev} className={styles.iconButton}>
            <ChevronLeft aria-hidden />
            <span className="sr-only">{params.view === 'month' ? '이전 달' : '이전 주'}</span>
          </Button>
          <h2 className={styles.title} aria-live="polite">
            {title}
          </h2>
          <Button variant="soft" onClick={goNext} className={styles.iconButton}>
            <ChevronRight aria-hidden />
            <span className="sr-only">{params.view === 'month' ? '다음 달' : '다음 주'}</span>
          </Button>
          <Button variant="outline" onClick={goToday}>
            오늘
          </Button>
        </div>
        <div className={styles.controls}>
          <div className={styles.views} role="group" aria-label="보기">
            {(['month', 'week'] as const).map((view) => (
              <button
                key={view}
                type="button"
                className={styles.view}
                aria-pressed={params.view === view}
                onClick={() => setView(view)}
              >
                {view === 'month' ? '월' : '주'}
              </button>
            ))}
          </div>
          <div className={styles.assignee}>
            <label htmlFor={assigneeId} className={styles.assigneeLabel}>
              담당자
            </label>
            <select
              id={assigneeId}
              className={styles.select}
              value={params.assignee ?? ''}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">전체</option>
              {members.data?.members.map((member) => (
                <option key={member.id} value={member.login}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {calendar.isError && !calendar.data ? (
        <ErrorState onRetry={() => void calendar.refetch()} />
      ) : (
        <table className={styles.table} data-view={params.view} aria-busy={calendar.isFetching}>
          <caption className="sr-only">
            {title} 캘린더
            {params.assignee ? `, 담당자 ${params.assignee}` : ''}
          </caption>
          <thead>
            <tr>
              {WEEKDAYS.map((weekday) => (
                <th key={weekday} scope="col" className={styles.weekday}>
                  <abbr title={`${weekday}요일`}>{weekday}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, row) => (
              <tr key={week[0]}>
                {week.map((day, col) => (
                  <DayCell
                    key={day}
                    day={day}
                    col={col}
                    muted={params.view === 'month' && !sameMonth(day, anchor)}
                    today={day === today}
                    segments={layouts[row]!.segments}
                    lanes={
                      params.view === 'month'
                        ? Math.min(layouts[row]!.lanes, MONTH_LANES)
                        : layouts[row]!.lanes
                    }
                    count={issuesOnDay(day, issues).length}
                    onOpen={() => daySheet.open(day)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className={styles.note}>
        마감일이 없는 이슈는 캘린더에 보이지 않아요.{' '}
        <Link href={`/teams/${teamId}/issues?view=unscheduled` as Route} className={styles.link}>
          이슈 목록의 &quot;일정 없음&quot;에서 보기
        </Link>
      </p>

      <OverlaySheet
        overlay={daySheet}
        title={daySheet.id ? `${dayLabel(daySheet.id)} 이슈` : '이슈'}
        description="이 날 진행하거나 마감하는 이슈예요."
      >
        {daySheet.id && (
          <DayIssues
            teamId={teamId}
            issues={issuesOnDay(daySheet.id, issues)}
            onOpenIssue={(href) => void daySheet.closeThen(href)}
          />
        )}
      </OverlaySheet>
    </>
  );
}

/**
 * One date: a button that opens the day sheet ("11월 3일 화요일, 이슈 2개", blueprint §6-2) with the
 * bars underneath. Bars are visual only; the button's name and the sheet carry the same information.
 */
function DayCell({
  day,
  col,
  muted,
  today,
  segments,
  lanes,
  count,
  onOpen,
}: {
  day: string;
  col: number;
  muted: boolean;
  today: boolean;
  segments: Segment[];
  lanes: number;
  count: number;
  onOpen: () => void;
}) {
  const covering = segments.filter(
    (segment) => segment.startCol <= col && col < segment.startCol + segment.span,
  );
  const hidden = covering.filter((segment) => segment.lane >= lanes).length;
  const month = Number(day.slice(5, 7));
  const weekday = WEEKDAYS[parseISO(day).getDay()];
  const rest = `일 ${weekday}요일, ${count > 0 ? `이슈 ${count}개` : '이슈 없음'}${today ? ', 오늘' : ''}`;

  return (
    <td className={styles.cell} data-muted={muted} aria-current={today ? 'date' : undefined}>
      {/* The button covers the whole cell (::after); the bars sit outside it. Its name comes from its
          content — "11월 1일 일요일, 이슈 2개" around the visible "1" — so the visible text is part of
          the name (WCAG 2.5.3), which an aria-label would break */}
      <button type="button" className={styles.dayButton} onClick={onOpen}>
        <span className="sr-only">{month}월 </span>
        <span className={styles.dayNumber}>{dayNumber(day)}</span>
        <span className="sr-only">{rest}</span>
      </button>
      <div className={styles.bars} aria-hidden>
        {Array.from({ length: lanes }, (_, lane) => {
          const segment = covering.find((item) => item.lane === lane);
          if (!segment) return <span key={lane} className={styles.gap} />;
          return (
            <Bar
              key={lane}
              segment={segment}
              first={segment.startCol === col}
              last={segment.startCol + segment.span - 1 === col}
            />
          );
        })}
        {hidden > 0 && <span className={styles.more}>+{hidden}</span>}
      </div>
    </td>
  );
}

function Bar({ segment, first, last }: { segment: Segment; first: boolean; last: boolean }) {
  const { issue } = segment;
  return (
    <span
      className={styles.bar}
      data-dot={segment.dot}
      data-overdue={issue.overdue}
      data-done={issue.status === 'DONE'}
      // Round only where the issue really starts / ends, not where the week cuts it
      data-round-start={first && segment.starts}
      data-round-end={last && segment.ends}
      style={{ '--span': segment.span } as CSSProperties}
    >
      {/* The title runs across the segment from its first day (hidden on narrow month cells) */}
      {first && <span className={styles.barTitle}>{issue.title}</span>}
    </span>
  );
}

/** The day sheet: that day's issues, each opening 12 (07 TODO 15) */
function DayIssues({
  teamId,
  issues,
  onOpenIssue,
}: {
  teamId: string;
  issues: IssueRow[];
  onOpenIssue: (href: Route) => void;
}) {
  if (issues.length === 0) return <p className={styles.note}>이 날 일정이 있는 이슈가 없어요.</p>;
  return (
    <ul className={styles.dayList}>
      {issues.map((issue) => {
        const href = `/teams/${teamId}/issues/${issue.id}` as Route;
        const titleId = `day-issue-${issue.id}`;
        return (
          <li key={issue.id}>
            <article aria-labelledby={titleId} className={styles.dayItem}>
              <p className={styles.repo}>
                {issue.repoName} #{issue.number}
              </p>
              <h3 id={titleId} className={styles.dayTitle}>
                <Link
                  href={href}
                  className={styles.dayLink}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenIssue(href);
                  }}
                >
                  {issue.title}
                </Link>
              </h3>
              <p className={styles.dayMeta}>
                <span className={styles.status}>{ISSUE_STATUS_LABELS[issue.status]}</span>
                <span className={issue.overdue ? styles.overdue : undefined}>
                  {issue.startDate && (
                    <>
                      <time dateTime={issue.startDate}>{formatDate(issue.startDate)}</time>
                      {' ~ '}
                    </>
                  )}
                  마감 <time dateTime={issue.dueDate!}>{formatDate(issue.dueDate!)}</time>
                  {issue.overdue && ' · 마감 지남'}
                </span>
                {issue.assignees.length > 0 && (
                  <span>{issue.assignees.map((user) => user.name).join(', ')}</span>
                )}
              </p>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
