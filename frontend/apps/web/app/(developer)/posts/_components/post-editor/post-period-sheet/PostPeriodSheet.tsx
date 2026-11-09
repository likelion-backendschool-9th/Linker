'use client';

// Own region: 22 start/end period sheet (Figma 368:3896) on the shared date wheel sheet
import { todayKst } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { DatePickerSheet } from '../../../../_components/date-picker-sheet';

export type PeriodField = 'start' | 'end';

type PostPeriodSheetProps = {
  /** Current form values (`yyyy-MM`); empty string = unset */
  start: string;
  end: string;
  onSave: (field: PeriodField, value: string) => void;
};

/** The period is month precision (Policy / ERD); the day wheel opens on today's day of month */
function toWheelDate(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return '';
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const day = Math.min(Number(todayKst().slice(-2)), lastDay);
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** "시작일" / "마감일" sheet: three-column wheel, then "저장" (Figma 364:1449) */
export function PostPeriodSheet({ start, end, onSave }: PostPeriodSheetProps) {
  const overlay = useOverlay('post-period');
  const field: PeriodField | null =
    overlay.id === 'start' || overlay.id === 'end' ? overlay.id : null;
  const title = field === 'end' ? '마감일' : '시작일';
  const current = field === 'end' ? end : start;

  return (
    <DatePickerSheet
      key={field ?? 'closed'}
      overlay={{ ...overlay, isOpen: overlay.isOpen && field !== null }}
      title={title}
      description={`${title}을 고르고 저장을 누르면 반영돼요.`}
      value={toWheelDate(current)}
      onSave={(date) => {
        if (field) onSave(field, date.slice(0, 7));
      }}
    />
  );
}
