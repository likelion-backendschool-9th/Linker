import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { useAppSignalStore } from '@/stores/app-signal-store';
import { renderWithProviders } from '@/test/render-with-providers';

import { PlanLimitSheet } from './plan-limit-sheet';

beforeEach(() => {
  resetOverlayHistory();
  useAppSignalStore.setState({ planLimit: null });
});

it('opens on PLAN_LIMIT and routes to /subscribe?reason=', async () => {
  const push = vi.fn();
  vi.mocked(useRouter).mockReturnValue({
    push,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  } as never);
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  renderWithProviders(<PlanLimitSheet />);

  act(() => {
    useAppSignalStore.setState({
      planLimit: {
        reason: 'POST_PHOTOS',
        message: '사진은 5장까지 올릴 수 있어요. Pro로 10장까지 늘릴 수 있어요.',
      },
    });
  });

  expect(await screen.findByRole('heading', { name: '지금 플랜으로는 더 할 수 없어요' })).toBeInTheDocument();
  expect(
    screen.getByText('사진은 5장까지 올릴 수 있어요. Pro로 10장까지 늘릴 수 있어요.'),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '구독 알아보기' }));
  expect(useAppSignalStore.getState().planLimit).toBeNull();
  expect(push).toHaveBeenCalledWith('/subscribe?reason=POST_PHOTOS');
});
