import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { DeleteConfirmDialog } from './delete-confirm-dialog';

beforeEach(() => resetOverlayHistory());

it('passes the overlay oid to onConfirm when deleting', async () => {
  const onConfirm = vi.fn();
  renderWithProviders(
    <DeleteConfirmDialog
      title="게시물을 삭제할까요?"
      description="좋아요와 댓글도 함께 삭제돼요."
      onConfirm={onConfirm}
    />,
    { searchParams: '?overlay=delete-confirm&oid=42' },
  );

  expect(await screen.findByRole('heading', { name: '게시물을 삭제할까요?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '삭제' }));
  expect(onConfirm).toHaveBeenCalledWith('42');
});
