import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import {
  CalendarLoadingActions,
  CalendarPageSkeleton,
} from './_components/calendar-page-skeleton/CalendarPageSkeleton';

/** Figma 982:1598 "15-스켈레톤" — stack header, team tabs, month chrome, chip bones. */
export default function CalendarLoading() {
  return (
    <PageFrame
      title="캘린더"
      variant="stack"
      backHref="/workspace"
      actions={<CalendarLoadingActions />}
    >
      <CalendarPageSkeleton />
    </PageFrame>
  );
}
