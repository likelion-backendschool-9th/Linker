import { act, render, screen } from '@testing-library/react';

import { toast, useToastStore } from '@/stores/toast-store';

import { Toaster } from './Toaster';

afterEach(() => useToastStore.setState({ toasts: [] }));

it('renders top and bottom toasts in their own regions, and a keyed toast replaces the last', () => {
  render(<Toaster />);
  act(() => {
    toast('저장했어요.');
    toast('제목을 입력해 주세요.', { tone: 'alert', placement: 'top', key: 'form' });
  });
  expect(screen.getByText('저장했어요.')).toBeInTheDocument();
  expect(screen.getByText('제목을 입력해 주세요.')).toBeInTheDocument();

  act(() => toast('소개를 입력해 주세요.', { tone: 'alert', placement: 'top', key: 'form' }));
  expect(screen.queryByText('제목을 입력해 주세요.')).not.toBeInTheDocument();
  expect(screen.getByText('소개를 입력해 주세요.')).toBeInTheDocument();
  expect(useToastStore.getState().toasts).toHaveLength(2);
});
