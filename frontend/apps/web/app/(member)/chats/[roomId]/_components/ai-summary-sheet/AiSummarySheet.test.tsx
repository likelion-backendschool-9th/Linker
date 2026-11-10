import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import type { AiChatSummary, SharedAiSummary } from '../ai-summary-fab/api';

import { AiSummarySheet } from './AiSummarySheet';

const DONE: AiChatSummary = {
  summaryId: 1,
  status: 'DONE',
  phase: 'DONE',
  progress: 100,
  queueAhead: 0,
  remainingSeconds: null,
  summary: '배포 일정을 이야기했어요. 금요일에 배포하기로 했어요.',
  messageCount: 42,
  sharedMessageId: null,
  usedToday: 3,
  limit: 10,
  disclaimer: 'AI가 만든 요약이라 틀릴 수 있어요',
};

function OpenSheet(props: {
  summary: AiChatSummary | SharedAiSummary;
  onShare?: () => void;
  onRenew?: () => void;
  withActions?: boolean;
}) {
  const overlay = useOverlay('ai-summary');
  return (
    <AiSummarySheet
      overlay={overlay}
      summary={props.summary}
      actions={
        props.withActions === false
          ? undefined
          : {
              sharing: false,
              onShare: props.onShare ?? (() => {}),
              onRenew: props.onRenew ?? (() => {}),
            }
      }
    />
  );
}

const open = { searchParams: '?overlay=ai-summary' };

it('shows the paragraph with renew and share, without the count or disclaimer', async () => {
  const onShare = vi.fn();
  const onRenew = vi.fn();
  renderWithProviders(<OpenSheet summary={DONE} onShare={onShare} onRenew={onRenew} />, open);

  expect(await screen.findByRole('dialog', { name: 'AI 요약' })).toBeVisible();
  expect(screen.getByText(DONE.summary!)).toBeVisible();
  expect(screen.queryByText(/3\/10/)).toBeNull();
  expect(screen.queryByText('AI가 만든 요약이라 틀릴 수 있어요')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: '새로 요약 받기' }));
  expect(onRenew).toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '채팅창에 공유하기' }));
  expect(onShare).toHaveBeenCalled();
});

it('shows a shared card paragraph without the own-summary actions', async () => {
  renderWithProviders(<OpenSheet summary={{ summary: '공유된 요약' }} withActions={false} />, open);
  expect(await screen.findByText('공유된 요약')).toBeVisible();
  expect(screen.queryByRole('button', { name: '채팅창에 공유하기' })).toBeNull();
  expect(screen.queryByRole('button', { name: '새로 요약 받기' })).toBeNull();
});

it('says when the summary is still running or failed', async () => {
  const { unmount } = renderWithProviders(
    <OpenSheet summary={{ ...DONE, status: 'PENDING', summary: null }} />,
    open,
  );
  expect(await screen.findByText('요약하는 중이에요')).toBeVisible();
  expect(screen.queryByRole('button', { name: '채팅창에 공유하기' })).toBeNull();
  unmount();

  renderWithProviders(<OpenSheet summary={{ ...DONE, status: 'FAILED', summary: null }} />, open);
  expect(await screen.findByText('요약하지 못했어요')).toBeVisible();
});
