import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';
import { PLAN_LIMITS } from '@/lib/policy';

import { MESSAGES, type MockMessage } from './fixtures/chat';
import { mockFetch } from './mock-fetch';

type Page = { items: MockMessage[]; hasMore: boolean };
const originalLength = MESSAGES.length;
beforeEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=developer; path=/`;
});
afterEach(() => {
  MESSAGES.splice(originalLength);
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});
const row = (id: number, roomId = 1, ageDays = 0): MockMessage => ({
  id,
  roomId,
  sender: null,
  type: 'TEXT',
  text: `대화 ${id}`,
  imageUrls: [],
  payload: null,
  createdAt: new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString(),
  editedAt: null,
  deletedAt: null,
});

it('loads older messages without overlap and fills a reconnect gap in ID order', async () => {
  for (let i = 0; i < 45; i++) MESSAGES.push(row(10_000 + i));
  const recent = await mockFetch<Page>('/api/v1/user/chat-rooms/1/messages');
  expect(recent.hasMore).toBe(true);
  const older = await mockFetch<Page>(
    `/api/v1/user/chat-rooms/1/messages?before=${recent.items[0]!.id}`,
  );
  expect(older.items.every((item) => item.id < recent.items[0]!.id)).toBe(true);
  const missed = await mockFetch<Page>('/api/v1/user/chat-rooms/1/messages?after=10042');
  expect(missed.items.map((item) => item.id)).toEqual([10043, 10044]);
});

it('does not expose free-team messages beyond the policy history window', async () => {
  MESSAGES.push(row(20_000, 2, PLAN_LIMITS.teamChatHistoryDays.free + 1));
  const page = await mockFetch<Page>('/api/v1/user/chat-rooms/2/messages');
  expect(page.items.some((item) => item.id === 20_000)).toBe(false);
});
