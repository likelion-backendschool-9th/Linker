import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { DraftRestoreSheet } from './DraftRestoreSheet';

beforeEach(() => resetOverlayHistory());

it('restores or discards through the Figma 708:2240 actions', async () => {
  const onRestore = vi.fn();
  const onDiscard = vi.fn();
  renderWithProviders(<DraftRestoreSheet onRestore={onRestore} onDiscard={onDiscard} />, {
    searchParams: '?overlay=draft-restore',
  });

  expect(await screen.findByRole('alertdialog', { name: '이어 쓰기' })).toBeInTheDocument();
  expect(
    screen.getByText('이어서 쓸까요? 새로 쓰면 저장된 기존 내용은 지워져요'),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '이어쓰기' }));
  expect(onRestore).toHaveBeenCalledOnce();
  expect(onDiscard).not.toHaveBeenCalled();

  renderWithProviders(<DraftRestoreSheet onRestore={onRestore} onDiscard={onDiscard} />, {
    searchParams: '?overlay=draft-restore',
  });
  await userEvent.click(await screen.findByRole('button', { name: '새로쓰기' }));
  expect(onDiscard).toHaveBeenCalledOnce();
});

it('closes with × without choosing, so the draft stays', async () => {
  const onRestore = vi.fn();
  const onDiscard = vi.fn();
  renderWithProviders(<DraftRestoreSheet onRestore={onRestore} onDiscard={onDiscard} />, {
    searchParams: '?overlay=draft-restore',
  });

  await userEvent.click(await screen.findByRole('button', { name: '닫기' }));
  expect(onRestore).not.toHaveBeenCalled();
  expect(onDiscard).not.toHaveBeenCalled();
});
