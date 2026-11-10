import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';
import { mockFetch } from './mock-fetch';
import { MESSAGES } from './fixtures/chat';
import { POSTS } from './fixtures/posts';
import { findTeam } from './fixtures/teams';
import { withReadState } from './fixtures/chat-reads';
import { subscribe } from './realtime-bus';
import type { ChatShareCard } from '@/features/share/chat-cards';
import type { ShareRoom } from '@/features/share/share-api';

beforeEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=developer; path=/`;
});
afterEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});
const getRooms = (q = '') =>
  mockFetch<{ items: ShareRoom[] }>(`/api/v1/user/me/share-targets?q=${encodeURIComponent(q)}`);
const send = (roomId: number, type = 'POST', targetId = 1) =>
  mockFetch<{ id: number; payload: ChatShareCard }>(
    `/api/v1/user/chat-rooms/${roomId}/share-cards`,
    {
      method: 'POST',
      body: JSON.stringify({ targetType: type, targetId, clientMessageId: crypto.randomUUID() }),
    },
  );

it('filters requests, read-only/archived teams and other accounts out of room choices', async () => {
  const team = findTeam(3)!;
  const previous = team.status;
  team.status = 'READ_ONLY';
  const rooms = await getRooms();
  team.status = previous;
  expect(rooms.items.map((room) => room.roomId)).toContain(1);
  expect(rooms.items.filter((room) => [3, 20, 21, 22, 30].includes(room.roomId))).toEqual([]);
  expect(rooms.items.every((room) => room.kind === 'TEAM' || room.kind === 'DIRECT')).toBe(true);
  expect((await getRooms('이도윤')).items.every((room) => room.title.includes('이도윤'))).toBe(
    true,
  );
  document.cookie = `${MOCK_ROLE_COOKIE}=recruiter; path=/`;
  const recruiterRooms = await getRooms();
  expect(recruiterRooms.items.length).toBeGreaterThan(0);
  expect(recruiterRooms.items.every((room) => room.kind === 'DIRECT' && room.roomId >= 30)).toBe(
    true,
  );
});

it('stores only a reference, broadcasts the card, and re-resolves visibility on the next read', async () => {
  const listener = vi.fn();
  const unsubscribe = subscribe('/topic/chat-rooms/1', listener);
  const original = POSTS[0]!.visibility;
  try {
    const response = await send(1);
    const stored = MESSAGES.find((message) => message.id === response.id)!;
    expect(stored.payload).toEqual({ targetType: 'POST', targetId: 1 });
    expect(response.payload).toMatchObject({
      available: true,
      linkPath: '/posts/1?from=chat_share',
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'MESSAGE',
        message: expect.objectContaining({ id: response.id }),
      }),
    );
    POSTS[0]!.visibility = 'UNDER_REVIEW';
    expect(withReadState(stored).payload).toMatchObject({
      available: false,
      title: '볼 수 없는 게시물이에요',
      imageUrl: null,
      linkPath: null,
    });
  } finally {
    unsubscribe();
    POSTS[0]!.visibility = original;
  }
});

it('rejects request/read-only sends and resolves recruit/profile targets', async () => {
  await expect(send(20)).rejects.toMatchObject({ status: 403 });
  const team = findTeam(3)!;
  const previous = team.status;
  try {
    team.status = 'READ_ONLY';
    await expect(send(3)).rejects.toMatchObject({ status: 403 });
  } finally {
    team.status = previous;
  }
  expect((await send(1, 'RECRUIT_POST')).payload).toMatchObject({
    targetType: 'RECRUIT_POST',
    available: true,
  });
  expect((await send(1, 'PROFILE', 2)).payload).toMatchObject({
    targetType: 'PROFILE',
    available: true,
    linkPath: '/user/doyun-lee',
  });
  expect((await send(1, 'POST', 999999)).payload).toMatchObject({
    available: false,
    linkPath: null,
  });
});

it('resolves the first Linker URL card in 1:1 history independently from external preview', () => {
  const original = MESSAGES.find((message) => message.roomId === 11)!;
  const enriched = withReadState({
    ...original,
    text: `${window.location.origin}/posts/1?from=share https://example.test/docs ${window.location.origin}/recruits/1`,
  });
  expect(enriched.payload).toMatchObject({
    linkerCard: { targetType: 'POST', targetId: 1, available: true },
  });
});

it('records the chat-share traffic source on a card visit', async () => {
  expect(await mockFetch('/api/v1/public/posts/1?from=chat_share')).toMatchObject({
    trafficSource: 'CHAT_SHARE',
  });
});

it('returns the original message on retry and rejects conflicting reuse of its client id', async () => {
  const clientMessageId = crypto.randomUUID();
  const request = {
    method: 'POST',
    body: JSON.stringify({ targetType: 'POST', targetId: 1, clientMessageId }),
  };
  const first = await mockFetch<{ id: number }>('/api/v1/user/chat-rooms/1/share-cards', request);
  expect(await mockFetch('/api/v1/user/chat-rooms/1/share-cards', request)).toMatchObject({
    id: first.id,
  });
  expect(MESSAGES.filter((message) => message.clientMessageId === clientMessageId)).toHaveLength(1);
  await expect(
    mockFetch('/api/v1/user/chat-rooms/1/share-cards', {
      ...request,
      body: JSON.stringify({ targetType: 'POST', targetId: 2, clientMessageId }),
    }),
  ).rejects.toMatchObject({ status: 409, code: 'STATE_CONFLICT' });
});
