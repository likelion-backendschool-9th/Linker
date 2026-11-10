'use client';

import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { ChatRoundLineLinearIcon } from '@solar-icons/static/linear/chat-round-line';
import { QuestionCircleLinearIcon } from '@solar-icons/static/linear/question-circle';
import { SlidersHorizontal } from 'lucide-react';
import { useParams } from 'next/navigation';

import { useLoaderPresence } from '@/components/ui/page-loading';
import { todayKst } from '@/lib/format/time';

import { TeamNav } from '../../../_components/team-nav';
import { sameMonth } from '../../_lib/calendar-grid';
import { calendarRange } from '../../_lib/calendar-queries';
import { dayNumber, monthTitle, WEEKDAYS } from '../calendar-view/hook';
import styles from './CalendarPageSkeleton.module.css';

/** Figma 982:1598 shows two chip bones (not the full legend). */
const CHIP_BONES = 2;

/** Header team-change icon (Figma); disabled until TeamFrame mounts the switcher. */
export function CalendarLoadingActions() {
  return (
    <button type="button" className={styles.headerIcon} aria-label="팀 변경" disabled>
      <SlidersHorizontal aria-hidden />
    </button>
  );
}

/** Figma 982:1598 "15-스켈레톤" — month chrome, chip bones, weekday/day grid, chat FAB. */
export function CalendarPageSkeleton({ teamId: teamIdProp }: { teamId?: string } = {}) {
  const params = useParams<{ id: string }>();
  const teamId = teamIdProp ?? params.id ?? 'preview';
  const today = todayKst();
  const { weeks } = calendarRange('month', today);
  useLoaderPresence();

  return (
    <>
      <TeamNav teamId={teamId} />
      <div className={styles.page} aria-busy="true">
        <p className="sr-only" role="status">
          불러오는 중이에요
        </p>
        <div className={styles.month} aria-hidden>
          {monthTitle(today)}
          <span
            className={styles.icon}
            dangerouslySetInnerHTML={{ __html: AltArrowDownLinearIcon }}
          />
        </div>
        <div className={styles.legend} aria-hidden>
          <ul className={styles.chips}>
            {Array.from({ length: CHIP_BONES }, (_, index) => (
              <li key={index}>
                <span className={styles.chipBone} />
              </li>
            ))}
            <li>
              <span className={styles.help}>
                <span
                  className={styles.icon}
                  dangerouslySetInnerHTML={{ __html: QuestionCircleLinearIcon }}
                />
              </span>
            </li>
          </ul>
        </div>
        <div className={styles.calendar} aria-hidden>
          <ol className={styles.weekdays}>
            {WEEKDAYS.map((weekday) => (
              <li key={weekday}>{weekday}</li>
            ))}
          </ol>
          {weeks.map((week) => (
            <div key={week[0]} className={styles.week}>
              <ul className={styles.days}>
                {week.map((day) => (
                  <li
                    key={day}
                    className={styles.day}
                    data-muted={!sameMonth(day, today)}
                    data-today={day === today}
                  >
                    {dayNumber(day)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <span className={styles.chat} aria-hidden>
        <span
          className={styles.chatIcon}
          dangerouslySetInnerHTML={{ __html: ChatRoundLineLinearIcon }}
        />
      </span>
    </>
  );
}
