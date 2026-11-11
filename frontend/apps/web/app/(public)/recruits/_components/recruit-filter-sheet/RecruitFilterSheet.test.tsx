import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { DEFAULT_FILTER_STATE, RecruitFilterSheet, type FilterState } from './RecruitFilterSheet';

/**
 * The list's wiring in miniature: the sheet opens on "sort" and applies into list state. Each test
 * starts with the sheet open from the URL, so it closes by updating the URL (the nuqs testing
 * adapter doesn't follow `history.back()`; the browser check covers the pushed case).
 */
const OPEN_SORT = '?overlay=recruit-filter&oid=sort';
function Harness({ onApply }: { onApply: (field: string, value: string | null) => void }) {
  const overlay = useOverlay('recruit-filter');
  const [selected, setSelected] = useState<FilterState>(DEFAULT_FILTER_STATE);
  return (
    <>
      <p>정렬: {selected.sort}</p>
      <button type="button" onClick={() => overlay.open('sort')}>
        정렬 열기
      </button>
      <RecruitFilterSheet
        overlay={overlay}
        selected={selected}
        onApply={(field, value) => {
          onApply(field, value);
          setSelected((current) => ({ ...current, [field]: value }));
        }}
      />
    </>
  );
}

it('only marks the sort while the sheet is open and applies it after "완료" closes it', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  renderWithProviders(<Harness onApply={onApply} />, { searchParams: OPEN_SORT });

  await user.click(await screen.findByRole('radio', { name: '마감순' }));

  // Picked, not applied: the list behind keeps its order
  expect(screen.getByRole('radio', { name: '마감순' })).toHaveAttribute('aria-checked', 'true');
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getByText('정렬: NEWEST')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '완료' }));

  await waitFor(() => expect(onApply).toHaveBeenCalledWith('sort', 'DEADLINE'));
  expect(screen.getByText('정렬: DEADLINE')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole('radio', { name: '마감순' })).not.toBeInTheDocument(),
  );
});

it('drops the pick when the sheet is closed without "완료"', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  renderWithProviders(<Harness onApply={onApply} />, { searchParams: OPEN_SORT });

  await user.click(await screen.findByRole('radio', { name: '마감순' }));
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('radio', { name: '마감순' })).not.toBeInTheDocument(),
  );

  // Reopening starts from what the list shows, not the dropped pick
  await user.click(screen.getByRole('button', { name: '정렬 열기' }));
  expect(await screen.findByRole('radio', { name: '최신순' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(onApply).not.toHaveBeenCalled();
});
