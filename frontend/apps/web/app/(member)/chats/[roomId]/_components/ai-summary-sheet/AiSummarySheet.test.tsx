import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import type { AiChatSummary } from '../ai-summary-fab/api';

import { AiSummarySheet } from './AiSummarySheet';

const DONE: AiChatSummary = {
  summaryId: 1,
  status: 'DONE',
  phase: 'DONE',
  progress: 100,
  queueAhead: 0,
  remainingSeconds: null,
  oneLine: '내일 저녁에 회의하기로 했어요.',
  decisions: [{ text: '금요일에 배포해요', messageId: 11 }],
  actionItems: [{ text: '민수: 리뷰하기', messageId: 99 }],
  openQuestions: [],
  messageCount: 42,
  sharedMessageId: null,
  usedToday: 3,
  limit: 10,
  disclaimer: 'AI가 만든 요약이라 틀릴 수 있어요',
};

function OpenSheet(props: {
  summary: AiChatSummary;
  onJump?: (id: number) => void;
  onShare?: () => void;
}) {
  const overlay = useOverlay('ai-summary');
  return (
    <AiSummarySheet
      overlay={overlay}
      summary={props.summary}
      loadedIds={new Set([11])}
      onJump={props.onJump ?? (() => {})}
      actions={{ sharing: false, onShare: props.onShare ?? (() => {}), onRenew: () => {} }}
    />
  );
}

it('shows the minutes sections, the disclaimer and the daily count', async () => {
  renderWithProviders(<OpenSheet summary={DONE} />, { searchParams: '?overlay=ai-summary' });
  expect(await screen.findByText('내일 저녁에 회의하기로 했어요.')).toBeVisible();
  expect(screen.getByRole('heading', { name: '결정한 것' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '할 일' })).toBeVisible();
  // Empty sections are left out
  expect(screen.queryByRole('heading', { name: '아직 정하지 못한 것' })).toBeNull();
  expect(screen.getByText('AI가 만든 요약이라 틀릴 수 있어요')).toBeVisible();
  expect(screen.getByText(/3\/10/)).toBeVisible();
});

it('only lines whose source is loaded scroll to it', async () => {
  const onJump = vi.fn();
  renderWithProviders(<OpenSheet summary={DONE} onJump={onJump} />, {
    searchParams: '?overlay=ai-summary',
  });
  await userEvent.click(await screen.findByRole('button', { name: /금요일에 배포해요/ }));
  expect(onJump).toHaveBeenCalledWith(11);
  expect(screen.queryByRole('button', { name: /민수: 리뷰하기/ })).toBeNull();
  expect(screen.getByText('민수: 리뷰하기')).toBeVisible();
});

it('offers sharing until the summary is shared', async () => {
  const onShare = vi.fn();
  const { unmount } = renderWithProviders(<OpenSheet summary={DONE} onShare={onShare} />, {
    searchParams: '?overlay=ai-summary',
  });
  await userEvent.click(await screen.findByRole('button', { name: '채팅에 공유' }));
  expect(onShare).toHaveBeenCalled();
  unmount();

  renderWithProviders(<OpenSheet summary={{ ...DONE, sharedMessageId: 5 }} />, {
    searchParams: '?overlay=ai-summary',
  });
  expect(await screen.findByText('채팅에 공유한 요약이에요')).toBeVisible();
  expect(screen.queryByRole('button', { name: '채팅에 공유' })).toBeNull();
});
