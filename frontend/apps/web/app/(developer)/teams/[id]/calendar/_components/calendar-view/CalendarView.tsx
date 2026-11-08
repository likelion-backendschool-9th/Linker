'use client';

// client boundary: month and sheets through the URL (nuqs), calendar query, help popover
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { QuestionCircleLinearIcon } from '@solar-icons/static/linear/question-circle';
import type { Route } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { ErrorState } from '@/components/ui/error-state/ErrorState';

import { boardStatusColorVar } from '../../../../../_lib/issue-status';
import { STATUS_CHIPS } from '../../../issues/_components/issue-list/hook';
import { issuesOnDay, sameMonth } from '../../_lib/calendar-grid';
import { CalendarDateSheet } from '../calendar-date-sheet';
import { CalendarDaySheet } from '../calendar-day-sheet';
import styles from './CalendarView.module.css';
import {
  dayNumber,
  MONTH_LANES,
  useCalendarView,
  useHelpPopover,
  WEEKDAYS,
  weekdayName,
} from './hook';

// Chip names of 11 (Figma 11): 작업 전 / 진행 / 정지 / 완료; other status names stay Policy's
const CHIP_LABELS = Object.fromEntries(
  STATUS_CHIPS.flatMap((chip) => (chip.status ? [[chip.status, chip.label]] : [])),
) as Record<string, string>;

/**
 * 15 Calendar (07 TODO 15), Figma 15 (234:219): month title (opens the date sheet, 368:3024), status
 * chips with a "?" note, then the Monday-first month with a bar per issue. A date with issues opens the
 * day sheet (368:2753).
 */
export function CalendarView({ teamId }: { teamId: string }) {
  const {
    anchor,
    today,
    weeks,
    calendar,
    issues,
    layouts,
    legend,
    daySheet,
    dateSheet,
    title,
    goToMonth,
  } = useCalendarView(teamId);
  const { open, buttonRef, popoverRef, popoverId, toggle } = useHelpPopover();

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.month}
        aria-haspopup="dialog"
        onClick={() => dateSheet.open()}
      >
        {title}
        <span
          aria-hidden
          className={styles.icon}
          dangerouslySetInnerHTML={{ __html: AltArrowDownLinearIcon }}
        />
        <span className="sr-only">, 날짜 선택</span>
      </button>

      <div className={styles.legend}>
        <ul className={styles.chips}>
          {legend.map(({ status, color }) => (
            <li
              key={status}
              className={styles.chip}
              style={{ '--status-color': boardStatusColorVar(color) } as CSSProperties}
            >
              <span className={styles.chipDot} aria-hidden />
              {CHIP_LABELS[status]}
            </li>
          ))}
          <li>
            <button
              ref={buttonRef}
              type="button"
              className={styles.help}
              aria-expanded={open}
              aria-controls={open ? popoverId : undefined}
              onClick={toggle}
            >
              <span
                aria-hidden
                className={styles.icon}
                dangerouslySetInnerHTML={{ __html: QuestionCircleLinearIcon }}
              />
              <span className="sr-only">캘린더 안내</span>
            </button>
          </li>
        </ul>
        {open && (
          <div ref={popoverRef} id={popoverId} className={styles.popover}>
            <p>마감일이 없는 이슈는 캘린더에 보이지 않아요.</p>
            <Link
              href={`/teams/${teamId}/issues?view=unscheduled` as Route}
              className={styles.popoverLink}
            >
              이슈 목록의 &quot;일정 없음&quot;에서 보기
            </Link>
          </div>
        )}
      </div>

      {calendar.isError && !calendar.data ? (
        <ErrorState onRetry={() => void calendar.refetch()} />
      ) : (
        <div className={styles.calendar} aria-busy={calendar.isFetching}>
          <ol className={styles.weekdays} aria-hidden>
            {WEEKDAYS.map((weekday) => (
              <li key={weekday}>{weekday}</li>
            ))}
          </ol>
          {weeks.map((week, row) => (
            <div key={week[0]} className={styles.week}>
              <ul className={styles.days}>
                {week.map((day, col) => {
                  const count = issuesOnDay(day, issues).length;
                  const muted = !sameMonth(day, anchor);
                  const isToday = day === today;
                  const name = (
                    <>
                      <span className="sr-only">{Number(day.slice(5, 7))}월 </span>
                      <span>{dayNumber(day)}</span>
                      <span className="sr-only">
                        일 {weekdayName(day)}요일{isToday ? ', 오늘' : ''}
                        {count > 0 ? `, 이슈 ${count}개` : ''}
                      </span>
                    </>
                  );
                  return (
                    <li
                      key={day}
                      className={styles.day}
                      data-muted={muted}
                      data-today={isToday}
                      aria-current={isToday ? 'date' : undefined}
                      style={{ '--col': col } as CSSProperties}
                    >
                      {count > 0 ? (
                        <button
                          type="button"
                          className={styles.dayButton}
                          aria-haspopup="dialog"
                          onClick={() => daySheet.open(day)}
                        >
                          {name}
                        </button>
                      ) : (
                        <span className={styles.dayNumber}>{name}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className={styles.bars} aria-hidden>
                {layouts[row]!.segments.filter((segment) => segment.lane < MONTH_LANES).map(
                  (segment) => (
                    <span
                      key={segment.issue.id}
                      className={styles.bar}
                      style={
                        {
                          gridColumn: `${segment.startCol + 1} / span ${segment.span}`,
                          gridRow: segment.lane + 1,
                          '--status-color': boardStatusColorVar(segment.issue.statusColor),
                        } as CSSProperties
                      }
                    >
                      {segment.issue.title}
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CalendarDaySheet teamId={teamId} overlay={daySheet} issues={issues} />
      <CalendarDateSheet overlay={dateSheet} anchor={anchor} onSave={goToMonth} />
    </div>
  );
}
