import { act, render, screen } from '@testing-library/react';

import { dismissToast, toast, useToastStore } from '@/stores/toast-store';

import { Toaster } from './Toaster';

afterEach(() => useToastStore.setState({ toasts: [] }));

it('renders top and bottom toasts in their own regions, and a keyed toast replaces the last', () => {
  render(<Toaster />);
  act(() => {
    toast('저장했어요.');
    toast('제목을 입력해 주세요.', { tone: 'error', placement: 'top', key: 'form' });
  });
  expect(screen.getByText('저장했어요.')).toBeInTheDocument();
  expect(screen.getByText('제목을 입력해 주세요.')).toBeInTheDocument();

  act(() => toast('소개를 입력해 주세요.', { tone: 'error', placement: 'top', key: 'form' }));
  expect(screen.queryByText('제목을 입력해 주세요.')).not.toBeInTheDocument();
  expect(screen.getByText('소개를 입력해 주세요.')).toBeInTheDocument();
  expect(useToastStore.getState().toasts).toHaveLength(2);
});

it('shows the four kinds from Figma 877:415: a dot for success, error and persistent, none for info', () => {
  render(<Toaster />);
  act(() => {
    toast('링크를 복사했어요');
    toast('로그인에 실패했어요', { tone: 'error' });
    toast('처리 중 입니다. 잠시만 기다려 주세요.', { tone: 'persistent', key: 'pending' });
    toast('이미 이의 제기를 접수했어요', { tone: 'info' });
  });

  const kind = (text: string) => screen.getByText(text).closest('[data-tone]');
  expect(kind('링크를 복사했어요')).toHaveAttribute('data-tone', 'success');
  expect(kind('로그인에 실패했어요')).toHaveAttribute('data-tone', 'error');
  expect(kind('처리 중 입니다. 잠시만 기다려 주세요.')).toHaveAttribute('data-tone', 'persistent');
  expect(kind('이미 이의 제기를 접수했어요')).toHaveAttribute('data-tone', 'info');
  expect(kind('링크를 복사했어요')?.querySelector('span[aria-hidden]')).not.toBeNull();
  expect(kind('이미 이의 제기를 접수했어요')?.querySelector('span[aria-hidden]')).toBeNull();

  // A persistent toast stays until its key is dismissed
  act(() => dismissToast('pending'));
  expect(screen.queryByText('처리 중 입니다. 잠시만 기다려 주세요.')).not.toBeInTheDocument();
});
