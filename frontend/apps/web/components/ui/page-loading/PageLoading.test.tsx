import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAppSignalStore } from '@/stores/app-signal-store';
import { renderWithProviders } from '@/test/render-with-providers';

import { LoadTimeoutScreen } from './LoadTimeoutScreen';
import { PageLoading } from './PageLoading';

beforeEach(() => useAppSignalStore.setState({ loadTimedOutAt: 0, loadersMounted: 0 }));

it('shows the loading orb and counts as loading while mounted', () => {
  const { unmount } = renderWithProviders(<PageLoading />);
  expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요');
  expect(useAppSignalStore.getState().loadersMounted).toBe(1);
  unmount();
  expect(useAppSignalStore.getState().loadersMounted).toBe(0);
});

it('shows the timeout screen with "돌아가기" once a load timed out, and clears it on 돌아가기', async () => {
  renderWithProviders(<LoadTimeoutScreen />);
  expect(screen.queryByRole('button', { name: '돌아가기' })).not.toBeInTheDocument();

  act(() => useAppSignalStore.setState({ loadTimedOutAt: Date.now() }));
  expect(screen.getByRole('alert')).toHaveTextContent('네트워크 연결 시간이 초과되었습니다.');
  await userEvent.setup().click(screen.getByRole('button', { name: '돌아가기' }));
  expect(useAppSignalStore.getState().loadTimedOutAt).toBe(0);
  expect(screen.queryByRole('button', { name: '돌아가기' })).not.toBeInTheDocument();
});
