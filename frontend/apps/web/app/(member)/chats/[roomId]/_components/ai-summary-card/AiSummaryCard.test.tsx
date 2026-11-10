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
  text: 'AI 요약 · 금요일에 배포하기로 했어요.',
  imageUrls: [],
  payload: {
    summaryId: 9,
    summary: '배포 일정을 이야기했어요. 금요일에 배포하기로 했어요.',
    messageCount: 49,
  },
  createdAt: '2026-11-10T13:32:00Z',
  editedAt: null,
  deletedAt: null,
  visibility: 'VISIBLE',
  updatedAt: '2026-11-10T13:32:00Z',
} as unknown as RoomMessage;

it('shows the title and the paragraph', () => {
  renderWithProviders(<AiSummaryCard message={MESSAGE} canMenu onMenu={() => {}} />);
  expect(screen.getByText('AI 채팅 요약')).toBeVisible();
  expect(screen.getByText('배포 일정을 이야기했어요. 금요일에 배포하기로 했어요.')).toBeVisible();
});

it('opens the full summary on tap and the message menu from the menu key', async () => {
  const onMenu = vi.fn();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<AiSummaryCard message={MESSAGE} canMenu onMenu={onMenu} />, {
    onUrlUpdate,
  });
  const card = screen.getByRole('button', { name: /요약 전체 보기/ });
  fireEvent.keyDown(card, { key: 'F10', shiftKey: true });
  expect(onMenu).toHaveBeenCalledWith(121);
  await userEvent.click(card);
  expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain(
    'overlay=ai-summary-card&oid=121',
  );
});

it('says so when the payload cannot be read', () => {
  renderWithProviders(<AiSummaryCard message={{ ...MESSAGE, payload: null }} canMenu={false} />);
  expect(screen.getByText('볼 수 없는 AI 요약이에요')).toBeVisible();
  expect(screen.queryByRole('button')).toBeNull();
});
