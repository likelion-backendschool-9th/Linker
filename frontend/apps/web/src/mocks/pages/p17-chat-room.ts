import { resolveIssueCard } from '../fixtures/chat-references';
import { recordRead, unreadMembers, withReadState } from '../fixtures/chat-reads';
import { messageActions } from '@/app/(member)/chats/[roomId]/_lib/message-actions';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { CHAT, PLAN_LIMITS } from '@/lib/policy';
import { emit } from '../realtime-bus';
import { daysAgo, del, fail, get, newId, patch, post, type MockRoute, type MockContext } from '../core/define';
import { findRoom, MESSAGES, ROOMS, UNREAD } from '../fixtures/chat';
import { POSTS } from '../fixtures/posts';
import { findTeam, TEAM_MEMBERS } from '../fixtures/teams';
import { brief, ME } from '../fixtures/users';

/**
 * 17 Chat room: `ChatRoomController` (REST). Live sending/receiving is `lib/realtime` (mock-realtime.ts),
 * which appends to the same MESSAGES list.
 */

const PAGE = 30;

function roomOr404(id: string) {
  const room = findRoom(id);
  if (!room) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  return room;
}

function editableMessage(params: MockContext['params'], viewer: MockContext['viewer']) {
  const room = roomOr404(params.roomId);
  const message = MESSAGES.find((item) => item.id === Number(params.messageId) && item.roomId === room.id);
  if (!message) fail(404, 'NOT_FOUND', '메시지를 찾지 못했어요');
  const team = room.teamId ? findTeam(room.teamId) : undefined;
  const disabled = room.kind === 'REQUEST' || !!(team && ['READ_ONLY', 'ARCHIVED'].includes(team.status));
  return { message, allowed: messageActions(withReadState(message), viewer.me?.login ?? null, team?.myRole ?? null, disabled, Date.now()) };
}

export const routes: MockRoute[] = [
  get('/api/v1/user/chat-rooms/:roomId', ({ params }) => {
    const room = roomOr404(params.roomId!);
    const team = room.teamId ? findTeam(room.teamId) : undefined;
    return {
      ...room,
      members: room.teamId
        ? (TEAM_MEMBERS[room.teamId] ?? []).map((m) => m.user)
        : [brief(ME), room.counterpart],
      team: team
        ? {
            id: team.id,
            name: team.name,
            plan: team.plan,
            myRole: team.myRole,
            status: team.status,
          }
        : null,
      aiSummaryEnabled: team?.plan === 'FLEX',
      // Free teams only see the last 60 days (04 ch. 8)
      historyLimitDays: team && team.plan === 'FREE' ? 60 : null,
    };
  }),
  get('/api/v1/user/chat-rooms/:roomId/messages', ({ params, query }) => {
    const room = roomOr404(params.roomId);
    const team = room.teamId ? findTeam(room.teamId) : undefined;
    const cutoff =
      team?.plan === 'FREE'
        ? Date.now() - PLAN_LIMITS.teamChatHistoryDays.free * 24 * 60 * 60 * 1000
        : null;
    const all = MESSAGES.filter(
      (m) =>
        m.roomId === Number(params.roomId) &&
        (cutoff === null || new Date(m.createdAt).getTime() >= cutoff),
    ).sort((a, b) => a.id - b.id);
    const before = query.get('before');
    const after = query.get('after');
    if (after) return { items: all.filter((m) => m.id > Number(after)).map(withReadState), hasMore: false };
    const older = before ? all.filter((m) => m.id < Number(before)) : all;
    return { items: older.slice(-PAGE).map(withReadState), hasMore: older.length > PAGE };
  }),
  post('/api/v1/user/chat-rooms/:roomId/read', ({ params, body, viewer }) => {
    const room = roomOr404(params.roomId);
    const id = Number(body.lastReadMessageId);
    if (!Number.isSafeInteger(id) || !MESSAGES.some((item) => item.roomId === room.id && item.id === id)) {
      fail(404, 'NOT_FOUND', '메시지를 찾지 못했어요');
    }
    recordRead(room.id, viewer.me!.id, id);
    UNREAD[room.id] = 0;
    emit(`/topic/chat-rooms/${room.id}`, { event: 'READ', roomId: room.id });
    emit('/user/queue/chat-rooms', { event: 'READ', roomId: room.id });
    return undefined;
  }),
  get('/api/v1/user/chat-rooms/:roomId/messages/:messageId/unread-members', ({ params }) => {
    const room = roomOr404(params.roomId);
    const message = MESSAGES.find((item) => item.roomId === room.id && item.id === Number(params.messageId));
    if (!message || !room.teamId || message.deletedAt || message.type === 'SYSTEM' || message.type === 'PR_EVENT') {
      fail(404, 'NOT_FOUND', '읽음 상태를 확인할 수 없는 메시지예요');
    }
    return { items: unreadMembers(message) };
  }),
  patch('/api/v1/user/chat-rooms/:roomId/messages/:messageId', ({ params, body, viewer }) => {
    const { message, allowed } = editableMessage(params, viewer);
    if (!allowed.edit) fail(403, 'FORBIDDEN', '이 메시지를 수정할 수 없어요');
    const text = normalizeLineBreaks(String(body.text ?? '')).trim();
    if (!countChars(text) || countChars(text) > CHAT.messageMax) {
      fail(400, 'INVALID_TEXT', '메시지 글자 수를 확인해 주세요');
    }
    message.text = text;
    message.editedAt = new Date().toISOString();
    emit(`/topic/chat-rooms/${message.roomId}`, { event: 'MESSAGE', message: withReadState(message) });
    return withReadState(message);
  }),
  del('/api/v1/user/chat-rooms/:roomId/messages/:messageId', ({ params, viewer }) => {
    const { message, allowed } = editableMessage(params, viewer);
    if (!allowed.delete) fail(403, 'FORBIDDEN', '이 메시지를 삭제할 수 없어요');
    message.deletedAt = new Date().toISOString();
    message.text = null;
    message.imageUrls = [];
    emit(`/topic/chat-rooms/${message.roomId}`, { event: 'MESSAGE', message: withReadState(message) });
    return undefined;
  }),
  patch('/api/v1/user/chat-rooms/:roomId/notification', ({ params, body }) => {
    roomOr404(params.roomId!).muted = Boolean(body.muted);
    return undefined;
  }),
  del('/api/v1/user/chat-rooms/:roomId/members/me', ({ params }) => {
    const index = ROOMS.findIndex((room) => room.id === Number(params.roomId));
    if (index >= 0) ROOMS.splice(index, 1);
    return undefined;
  }),
  // `[Included]` photo gallery
  get('/api/v1/user/chat-rooms/:roomId/images', ({ params }) => ({
    items: MESSAGES.filter((m) => m.roomId === Number(params.roomId) && m.imageUrls.length).flatMap(
      (m) => m.imageUrls.map((url) => ({ messageId: m.id, url, createdAt: m.createdAt })),
    ),
  })),
  get('/api/v1/user/chat-rooms/:roomId/pull-requests', ({ query }) => {
    const state = query.get('state') ?? 'open';
    const all = [
      {
        number: 31,
        title: 'feat: 로그인 시트',
        state: 'open',
        author: '한서준',
        url: 'https://github.com/linker-hack/linker-web/pull/31',
      },
      {
        number: 29,
        title: 'fix: 피드 스켈레톤 높이',
        state: 'open',
        author: '박서연',
        url: 'https://github.com/linker-hack/linker-web/pull/29',
      },
      {
        number: 26,
        title: 'chore: eslint 규칙 정리',
        state: 'merged',
        author: '이도윤',
        url: 'https://github.com/linker-hack/linker-api/pull/26',
      },
    ];
    return { items: all.filter((pr) => pr.state === state) };
  }),
  get('/api/v1/user/chat-rooms/:roomId/mention-candidates', ({ params }) => ({
    items: (TEAM_MEMBERS[roomOr404(params.roomId!).teamId ?? 0] ?? []).map((m) => m.user),
  })),
  get('/api/v1/user/chat-rooms/:roomId/issue-cards', ({ params, query, viewer }) => {
    const room = roomOr404(params.roomId);
    const card = resolveIssueCard(room.id, Number(query.get('number')), Number(query.get('repoId')), viewer.me!.id);
    if (!card) fail(404, 'NOT_FOUND', '이슈를 찾지 못했어요');
    return card;
  }),
  get('/api/v1/user/chat-rooms/:roomId/link-preview', ({ query }) => ({
    url: query.get('url'),
    title: '링크 미리보기 제목',
    description: '서버가 OG 태그를 읽어 온 설명이에요.',
    imageUrl: null as string | null,
  })),
  get('/api/v1/user/chat-rooms/:roomId/search', ({ params, query }) => {
    const q = (query.get('q') ?? '').trim();
    return {
      items: q
        ? MESSAGES.filter(
            (m) => m.roomId === Number(params.roomId) && !m.deletedAt && m.text?.includes(q),
          )
        : [],
    };
  }),
  // Rooms I can share to: team rooms + open 1:1 rooms (04 POL-P-7)
  get('/api/v1/user/me/share-targets', ({ query }) => {
    const q = (query.get('q') ?? '').trim();
    return {
      items: ROOMS.filter((r) => (r.kind === 'TEAM' && r.teamId !== 3) || r.kind === 'DIRECT')
        .filter((r) => !q || r.title.includes(q))
        .map(({ id, kind, title }) => ({ roomId: id, kind, title })),
    };
  }),
  post('/api/v1/user/chat-rooms/:roomId/share-cards', ({ params, body }) => {
    const target = POSTS.find((p) => p.id === Number(body.targetId));
    const message = {
      id: newId(),
      roomId: Number(params.roomId),
      sender: brief(ME),
      type: 'SHARE_CARD' as const,
      text: null,
      imageUrls: [],
      payload: {
        targetType: String(body.targetType ?? 'POST'),
        targetId: Number(body.targetId),
        title: target?.intro ?? '공유한 항목',
        subtitle: target?.author.name ?? '',
      },
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
    };
    MESSAGES.push(message);
    return withReadState(message);
  }),
  post(
    '/api/v1/user/chat-rooms/direct',
    ({ body }) => {
      const existing = ROOMS.find(
        (r) => r.kind === 'DIRECT' && r.counterpart?.id === Number(body.userId),
      );
      // Mutual follow / same team → room; otherwise a message request (POL-C-4)
      return existing ? { roomId: existing.id, kind: 'DIRECT' } : { roomId: 21, kind: 'REQUEST' };
    },
    { only: 'developer' },
  ),

  // `[Included]` AI summary (Flex): free teams get the plan prompt
  post('/api/v1/user/chat-rooms/:roomId/ai-summaries', ({ params }) => {
    const room = roomOr404(params.roomId!);
    const team = room.teamId ? findTeam(room.teamId) : undefined;
    if (team?.plan !== 'FLEX') {
      fail(403, 'PLAN_LIMIT', 'Flex 구독 팀만 쓸 수 있어요. 오너에게 Flex를 요청해 보세요.', {
        reason: 'AI_SUMMARY',
      });
    }
    return { summaryId: newId(), usedToday: 3, limit: 10 };
  }),
  get('/api/v1/user/chat-rooms/:roomId/ai-summaries/:summaryId', ({ params }) => ({
    summaryId: Number(params.summaryId),
    createdAt: daysAgo(0),
    messageCount: 42,
    oneLine: '로그인 시트 구현을 오늘 안에 끝내고 내일 저녁에 회의하기로 했어요.',
    decisions: ['로그인 시트는 오늘 안에 PR 올리기', '다음 회의는 내일 저녁'],
    todos: [
      { title: '피드 카드 컴포넌트 마무리', messageId: 104 },
      { title: '웹훅 서명 검증 버그 확인', messageId: 106 },
    ],
    openQuestions: ['공유 시트 문구를 확정해야 해요'],
    disclaimer: 'AI가 만든 요약이라 틀릴 수 있어요',
  })),
  post('/api/v1/user/chat-rooms/:roomId/ai-summaries/:summaryId/share', ({ params }) => {
    const message = {
      id: newId(),
      roomId: Number(params.roomId),
      sender: brief(ME),
      type: 'AI_SUMMARY' as const,
      text: null,
      imageUrls: [],
      payload: {
        summaryId: Number(params.summaryId),
        oneLine: '로그인 시트 구현을 오늘 안에 끝내기로 했어요.',
      },
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
    };
    MESSAGES.push(message);
    return withReadState(message);
  }),

  // `[Included]` Recruiting offer (recruiter → developer). 1,000 chars, no photos (POL-H-3)
  post('/api/v1/recruiter/chat-requests', ({ body }) => {
    const text = String(body.text ?? '');
    if (text.length > 1000) fail(400, 'TOO_LONG', '1,000자까지 보낼 수 있어요');
    return { roomId: newId(), status: 'REQUESTED' };
  }),
];
