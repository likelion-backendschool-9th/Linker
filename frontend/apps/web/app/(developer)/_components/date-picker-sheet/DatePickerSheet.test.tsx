import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { DatePickerSheet } from './DatePickerSheet';

function Harness({ value, onSave }: { value: string; onSave: (date: string) => void }) {
  const overlay = useOverlay('recruit-deadline');
  return (
    <DatePickerSheet
      overlay={overlay}
      title="마감일"
      description="마감일을 고르고 저장을 누르면 반영돼요."
      value={value}
      min="2026-11-09"
      max="2027-01-08"
      onSave={onSave}
    />
  );
}

const selected = (list: HTMLElement) =>
  within(list).getByRole('option', { selected: true }).textContent;

afterEach(() => {
  vi.useRealTimers();
});

it('moves one row per wheel gesture, however far the gesture scrolls', () => {
  vi.useFakeTimers();
  renderWithProviders(<Harness value="2026-11-20" onSave={vi.fn()} />, {
    searchParams: '?overlay=recruit-deadline',
  });
  const days = screen.getByRole('listbox', { name: '일' });
  expect(selected(days)).toBe('20일');

  // One trackpad / mouse gesture = a burst of wheel events (300px in total)
  for (let i = 0; i < 6; i += 1) fireEvent.wheel(days, { deltaY: 50 });
  expect(selected(days)).toBe('21일');

  // After the gesture settles, the next one moves exactly one more row
  act(() => {
    vi.advanceTimersByTime(200);
  });
  fireEvent.wheel(days, { deltaY: -120 });
  expect(selected(days)).toBe('20일');
});

it('keeps the wheels inside min / max and saves the chosen date', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  renderWithProviders(<Harness value="" onSave={onSave} />, {
    searchParams: '?overlay=recruit-deadline',
  });
  const sheet = screen.getByRole('dialog', { name: '마감일' });
  const years = within(sheet).getByRole('listbox', { name: '연도' });
  expect(
    within(years)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['26년', '27년']);

  await user.click(within(years).getByRole('option', { name: '27년' }));
  const months = within(sheet).getByRole('listbox', { name: '월' });
  expect(
    within(months)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['1월']);
  const days = within(sheet).getByRole('listbox', { name: '일' });
  expect(within(days).getAllByRole('option')).toHaveLength(8);

  await user.click(within(days).getByRole('option', { name: '3일' }));
  await user.click(within(sheet).getByRole('button', { name: '저장' }));
  expect(onSave).toHaveBeenCalledWith('2027-01-03');
});
