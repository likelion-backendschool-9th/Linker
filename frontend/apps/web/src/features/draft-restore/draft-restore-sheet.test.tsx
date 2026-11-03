import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { DraftRestoreSheet } from './draft-restore-sheet';

beforeEach(() => resetOverlayHistory());

it('restores or discards through the documented actions', async () => {
  const onRestore = vi.fn();
  const onDiscard = vi.fn();
  renderWithProviders(<DraftRestoreSheet onRestore={onRestore} onDiscard={onDiscard} />, {
    searchParams: '?overlay=draft-restore',
  });

  expect(await screen.findByRole('heading', { name: '작성하던 내용이 있어요' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '이어 쓰기' }));
  expect(onRestore).toHaveBeenCalledOnce();

  renderWithProviders(<DraftRestoreSheet onRestore={onRestore} onDiscard={onDiscard} />, {
    searchParams: '?overlay=draft-restore',
  });
  await userEvent.click(await screen.findByRole('button', { name: '새로 쓰기' }));
  expect(onDiscard).toHaveBeenCalledOnce();
});
