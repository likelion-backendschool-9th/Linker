import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomMessage } from '../../_lib/room-api';

import { AiSummaryCard } from './AiSummaryCard';

const MESSAGE = {
  id: 121,
  roomId: 20,
  unreadCount: 0,
  clientMessageId: null,
  sender: { id: 2, username: 'yunsu', name: '윤수', avatarUrl: null },
  type: 'AI_SUMMARY',
  text: 'AI 요약 · 금요일 배포로 정했어요',
  imageUrls: [],
  payload: {
    oneLine: '금요일 배포로 정했어요',
    decisions: [{ text: '금요일 배포', messageId: 3 }],
    actionItems: [
      { text: '민수: 리뷰', messageId: null },
      { text: '지현: 체크리스트', messageId: 4 },
    ],
    openQuestions: [],
    messageCount: 49,
    disclaimer: 'AI가 만든 요약이라 틀릴 수 있어요',
  },
  createdAt: '2026-11-10T13:32:00Z',
  editedAt: null,
  deletedAt: null,
  visibility: 'VISIBLE',
  updatedAt: '2026-11-10T13:32:00Z',
} as unknown as RoomMessage;

it('shows who shared it, the one line and the counts as a centered card', () => {
  renderWithProviders(
    <AiSummaryCard message={MESSAGE} senderName="윤수" canMenu onMenu={() => {}} />,
  );
  expect(screen.getByText(/윤수님이 AI 요약을 공유했어요/)).toBeVisible();
  expect(screen.getByText('금요일 배포로 정했어요')).toBeVisible();
  expect(screen.getByText('결정 1 · 할 일 2')).toBeVisible();
});

it('opens the minutes on tap and the message menu from the menu key', async () => {
  const onMenu = vi.fn();
  const onUrlUpdate = vi.fn();
  renderWithProviders(
    <AiSummaryCard message={MESSAGE} senderName="윤수" canMenu onMenu={onMenu} />,
    { onUrlUpdate },
  );
  const card = screen.getByRole('button', { name: /회의록 전체 보기/ });
  fireEvent.keyDown(card, { key: 'F10', shiftKey: true });
  expect(onMenu).toHaveBeenCalledWith(121);
  await userEvent.click(card);
  expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain(
    'overlay=ai-summary-card&oid=121',
  );
});

it('says so when the payload cannot be read', () => {
  renderWithProviders(
    <AiSummaryCard message={{ ...MESSAGE, payload: null }} senderName="윤수" canMenu={false} />,
  );
  expect(screen.getByText(/볼 수 없는 AI 요약이에요/)).toBeVisible();
  expect(screen.queryByRole('button')).toBeNull();
});
