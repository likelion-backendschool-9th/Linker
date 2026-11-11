import { resolveIssueCard } from '../fixtures/chat-references';
import { recordRead, unreadMembers, withReadState } from '../fixtures/chat-reads';
import { messageActions } from '@/app/(member)/chats/[roomId]/_lib/message-actions';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { CHAT, PLAN_LIMITS } from '@/lib/policy';
import { emit } from '../realtime-bus';
import {
  del,
  fail,
  get,
  hoursAgo,
  newId,
  patch,
  post,
  type MockRoute,
  type MockContext,
} from '../core/define';
import { findRoom, MESSAGES, ROOMS, UNREAD } from '../fixtures/chat';
import { findTeam, TEAM_MEMBERS } from '../fixtures/teams';
import { brief, DEVELOPERS, ME } from '../fixtures/users';
import { isBlocked } from './p00-common';
import { isRecruiterRoom, OFFERS } from './p33-recruiter-offers';
import { lastMessage, nextMessageId } from '../fixtures/chat';

/**
 * 17 Chat room: `ChatController` (REST). Live sending/receiving is `lib/realtime` (mock-realtime.ts),
 * which appends to the same MESSAGES list.
 */

const PAGE = 30;

/** AI summaries (POL-C-5): the mock walks QUEUED → READING → WRITING → DONE over ~14 s. */
type MockAiSummary = {
  id: number;
  roomId: number;
  userId: number;
  startedAt: number;
  sharedMessageId: number | null;
};
const AI_SUMMARIES: MockAiSummary[] = [];

function aiSummaryOr404(id: string) {
  const summary = AI_SUMMARIES.find((item) => item.id === Number(id));
  if (!summary) fail(404, 'NOT_FOUND', '요약을 찾지 못했어요');
  return summary;
}

function aiSummaryView(summary: MockAiSummary) {
  const elapsed = (Date.now() - summary.startedAt) / 1000;
  const done = elapsed >= 14;
  const phase = done ? 'DONE' : elapsed < 2 ? 'QUEUED' : elapsed < 8 ? 'READING' : 'WRITING';
  return {
    summaryId: summary.id,
    status: done ? 'DONE' : 'PENDING',
    phase,
    progress: done
      ? 100
      : phase === 'QUEUED'
        ? 0
        : Math.min(99, Math.floor(((elapsed - 2) / 12) * 100)),
    queueAhead: phase === 'QUEUED' ? 1 : 0,
    remainingSeconds: done || phase === 'QUEUED' ? null : Math.ceil(14 - elapsed),
    summary: done
      ? '로그인 시트와 웹훅 검증 작업 상황을 이야기했어요. 로그인 시트는 오늘 끝내고 내일 저녁 8시에 회의하기로 했어요. 민수님은 로그인 시트를 마무리하고 지현님은 웹훅 서명 검증을 리뷰하기로 했어요. 피드 카드 디자인은 누가 볼지 아직 정하지 못했어요.'
      : null,
    messageCount: 42,
    sharedMessageId: summary.sharedMessageId,
    usedToday: 3,
    limit: 10,
    disclaimer: 'AI가 만든 요약이라 틀릴 수 있어요',
  };
}

function roomOr404(id: string) {
  const room = findRoom(id);
  if (!room) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  return room;
}

function editableMessage(params: MockContext['params'], viewer: MockContext['viewer']) {
  const room = roomOr404(params.roomId);
  const message = MESSAGES.find(
    (item) => item.id === Number(params.messageId) && item.roomId === room.id,
  );
  if (!message) fail(404, 'NOT_FOUND', '메시지를 찾지 못했어요');
  const team = room.teamId ? findTeam(room.teamId) : undefined;
  const disabled =
    room.kind === 'REQUEST' || !!(team && ['READ_ONLY', 'ARCHIVED'].includes(team.status));
  return {
    message,
    allowed: messageActions(
      withReadState(message),
      viewer.me?.login ?? null,
      team?.myRole ?? null,
      disabled,
      Date.now(),
    ),
  };
}

export const routes: MockRoute[] = [
  get('/api/v1/user/chat-rooms/:roomId', ({ params }) => {
    const room = roomOr404(params.roomId!);
    const team = room.teamId ? findTeam(room.teamId) : undefined;
    return {
      ...room,
      title: room.counterpart?.name ?? room.title,
      members: room.teamId
        ? (TEAM_MEMBERS[room.teamId] ?? []).map((m) => ({ ...m.user, role: m.role }))
        : [
            { ...brief(ME), role: null },
            { ...room.counterpart, role: null },
          ],
      team: team
        ? {
            id: team.id,
            name: team.name,
            myRole: team.myRole,
            status: team.status,
            avatarUrl: team.orgAvatarUrl ?? null,
            aiSummaryEnabled: team.plan === 'FLEX',
          }
        : null,
      // Free teams only see the last 60 days (04 ch. 8)
      historyLimitDays: team && team.plan === 'FREE' ? 60 : null,
      myAiSummary: (() => {
        const latest = AI_SUMMARIES.filter((item) => item.roomId === room.id).at(-1);
        if (!latest || latest.sharedMessageId) return null;
        return { summaryId: latest.id, status: aiSummaryView(latest).status };
      })(),
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
    if (after)
      return { items: all.filter((m) => m.id > Number(after)).map(withReadState), hasMore: false };
    const older = before ? all.filter((m) => m.id < Number(before)) : all;
    return { items: older.slice(-PAGE).map(withReadState), hasMore: older.length > PAGE };
  }),
  post('/api/v1/user/chat-rooms/:roomId/read', ({ params, body, viewer }) => {
    const room = roomOr404(params.roomId);
    const id = Number(body.lastReadMessageId);
    if (
      !Number.isSafeInteger(id) ||
      !MESSAGES.some((item) => item.roomId === room.id && item.id === id)
    ) {
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
    const message = MESSAGES.find(
      (item) => item.roomId === room.id && item.id === Number(params.messageId),
    );
    if (
      !message ||
      !room.teamId ||
      message.deletedAt ||
      message.type === 'SYSTEM' ||
      message.type === 'PR_EVENT'
    ) {
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
    emit(`/topic/chat-rooms/${message.roomId}`, {
      event: 'MESSAGE',
      message: withReadState(message),
    });
    return withReadState(message);
  }),
  del('/api/v1/user/chat-rooms/:roomId/messages/:messageId', ({ params, viewer }) => {
    const { message, allowed } = editableMessage(params, viewer);
    if (!allowed.delete) fail(403, 'FORBIDDEN', '이 메시지를 삭제할 수 없어요');
    message.deletedAt = new Date().toISOString();
    message.text = null;
    message.imageUrls = [];
    emit(`/topic/chat-rooms/${message.roomId}`, {
      event: 'MESSAGE',
      message: withReadState(message),
    });
    return undefined;
  }),
  patch('/api/v1/user/chat-rooms/:roomId/notification', ({ params, body }) => {
    roomOr404(params.roomId!).muted = Boolean(body.muted);
    return undefined;
  }),
  del('/api/v1/user/chat-rooms/:roomId/members/me', ({ params }) => {
    const room = roomOr404(params.roomId!);
    if (room.kind !== 'DIRECT') fail(403, 'FORBIDDEN', '1:1 대화에서만 나갈 수 있어요');
    const index = ROOMS.findIndex((item) => item.id === room.id);
    if (index >= 0) ROOMS.splice(index, 1);
    return undefined;
  }),
  // `[Included]` photo gallery
  get('/api/v1/user/chat-rooms/:roomId/images', ({ params }) => ({
    items: MESSAGES.filter((m) => m.roomId === Number(params.roomId) && m.imageUrls.length).flatMap(
      (m) => m.imageUrls.map((url) => ({ messageId: m.id, url, createdAt: m.createdAt })),
    ),
  })),
  // B-owned PR list: same identifiers and GitHub update timestamp as the server DTO.
  get('/api/v1/user/chat-rooms/:roomId/pull-requests', ({ params, query, viewer }) => {
    const room = roomOr404(params.roomId);
    if (
      !room.teamId ||
      room.kind !== 'TEAM' ||
      !(TEAM_MEMBERS[room.teamId] ?? []).some((member) => member.user.id === viewer.me?.id)
    )
      fail(404, 'NOT_FOUND', '팀 채팅방을 찾지 못했어요');
    const state = query.get('state') ?? 'open';
    if (!['open', 'merged'].includes(state))
      fail(400, 'VALIDATION_ERROR', 'PR 상태를 확인해 주세요');
    const common = {
      repoId: 1,
      githubRepoId: 901,
      draft: false,
      repo: 'linker-hack/linker-web',
      githubUpdatedAt: hoursAgo(2),
    };
    const all = [
      {
        ...common,
        id: 31,
        githubPrId: 1031,
        number: 31,
        title: 'feat: 로그인 시트',
        state: 'open',
        author: '한서준',
        url: 'https://github.com/linker-hack/linker-web/pull/31',
      },
      {
        ...common,
        id: 29,
        githubPrId: 1029,
        number: 29,
        title: 'fix: 피드 스켈레톤 높이',
        state: 'open',
        author: '박서연',
        url: 'https://github.com/linker-hack/linker-web/pull/29',
      },
      {
        ...common,
        id: 28,
        githubPrId: 1028,
        number: 28,
        title: '로그인 5회 실패 시 임시 잠금',
        state: 'open',
        author: '김주은',
        url: 'https://github.com/linker-hack/linker-web/pull/28',
      },
      {
        ...common,
        id: 26,
        repoId: 2,
        githubRepoId: 902,
        githubPrId: 1026,
        repo: 'linker-hack/linker-api',
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
    const card = resolveIssueCard(
      room.id,
      Number(query.get('number')),
      Number(query.get('repoId')),
      viewer.me!.id,
    );
    if (!card) fail(404, 'NOT_FOUND', '이슈를 찾지 못했어요');
    return card;
  }),
  get('/api/v1/user/chat-rooms/:roomId/link-preview', ({ params, query }) => {
    const room = roomOr404(params.roomId);
    // Room 10's counterpart is a mutual follow in the mock; other DMs have no OG preview.
    if (room.kind === 'REQUEST' || (room.kind === 'DIRECT' && room.id !== 10)) return null;
    return {
      url: query.get('url'),
      title: '링크 미리보기 제목',
      description: '서버가 OG 태그를 읽어 온 설명이에요.',
      imageUrl: null,
    };
  }),
  get('/api/v1/user/chat-rooms/:roomId/search', ({ params, query }) => {
    const room = roomOr404(params.roomId);
    if (!room.teamId) fail(403, 'FORBIDDEN', '팀 채팅에서만 검색할 수 있어요');
    const q = (query.get('q') ?? '').trim();
    if (!q) fail(400, 'VALIDATION_ERROR', '검색어를 입력해 주세요');
    const team = findTeam(room.teamId);
    const cutoff =
      team?.plan === 'FREE'
        ? Date.now() - PLAN_LIMITS.teamChatHistoryDays.free * 24 * 60 * 60 * 1000
        : null;
    return {
      items: MESSAGES.filter(
        (m) =>
          m.roomId === room.id &&
          !m.deletedAt &&
          m.type === 'TEXT' &&
          m.text?.toLocaleLowerCase().includes(q.toLocaleLowerCase()) &&
          (cutoff === null || new Date(m.createdAt).getTime() >= cutoff),
      )
        .sort((a, b) => b.id - a.id)
        .map(withReadState),
      history: team?.plan === 'FREE' ? { applied: 'FREE_60_DAYS', flexSupported: false } : null,
    };
  }),
  // Rooms I can share to: team rooms + open 1:1 rooms (04 POL-P-7)
  get('/api/v1/user/me/share-targets', ({ query, viewer }) => {
    const q = (query.get('q') ?? '').trim().toLocaleLowerCase();
    return {
      items: ROOMS.filter(
        (r) =>
          r.kind !== 'REQUEST' &&
          (viewer.role === 'recruiter' ? isRecruiterRoom(r.id) : !isRecruiterRoom(r.id)) &&
          (!r.teamId || !['READ_ONLY', 'ARCHIVED'].includes(findTeam(r.teamId)?.status ?? '')) &&
          (!r.counterpart || !isBlocked(r.counterpart.id)),
      )
        .filter((r) => !q || r.title.toLocaleLowerCase().includes(q))
        .sort((a, b) =>
          (lastMessage(b.id)?.createdAt ?? b.createdAt).localeCompare(
            lastMessage(a.id)?.createdAt ?? a.createdAt,
          ),
        )
        .map(({ id, kind, title, teamId, counterpart }) => ({
          roomId: id,
          kind,
          title,
          avatarUrl: teamId
            ? (findTeam(teamId)?.orgAvatarUrl ?? null)
            : (counterpart?.avatarUrl ?? null),
        })),
    };
  }),
  post('/api/v1/user/chat-rooms/:roomId/share-cards', ({ params, body, viewer }) => {
    const room = roomOr404(params.roomId);
    if (
      room.kind === 'REQUEST' ||
      (room.teamId && ['READ_ONLY', 'ARCHIVED'].includes(findTeam(room.teamId)?.status ?? '')) ||
      (viewer.role === 'recruiter' ? !isRecruiterRoom(room.id) : isRecruiterRoom(room.id)) ||
      (room.counterpart && isBlocked(room.counterpart.id))
    )
      fail(403, 'FORBIDDEN', '공유할 수 없는 채팅방이에요.');
    if (
      !['POST', 'RECRUIT_POST', 'PROFILE'].includes(String(body.targetType)) ||
      !Number.isSafeInteger(body.targetId) ||
      Number(body.targetId) < 1 ||
      typeof body.clientMessageId !== 'string' ||
      !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(body.clientMessageId)
    ) {
      fail(400, 'VALIDATION_ERROR', '공유할 대상을 확인해 주세요');
    }
    const existing = MESSAGES.find(
      (item) => item.sender?.id === viewer.me!.id && item.clientMessageId === body.clientMessageId,
    );
    if (existing) {
      if (
        existing.roomId !== room.id ||
        existing.type !== 'SHARE_CARD' ||
        existing.payload?.targetType !== body.targetType ||
        existing.payload?.targetId !== body.targetId
      ) {
        fail(409, 'STATE_CONFLICT', '이미 사용한 메시지 식별자예요');
      }
      return withReadState(existing);
    }
    const message = {
      id: nextMessageId(),
      roomId: Number(params.roomId),
      sender: brief(viewer.me!),
      clientMessageId: body.clientMessageId,
      type: 'SHARE_CARD' as const,
      text: null,
      imageUrls: [],
      payload: {
        targetType: String(body.targetType ?? 'POST'),
        targetId: Number(body.targetId),
      },
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
    };
    MESSAGES.push(message);
    const response = withReadState(message);
    emit(`/topic/chat-rooms/${room.id}`, { event: 'MESSAGE', message: response });
    emit('/user/queue/chat-rooms', { event: 'MESSAGE', roomId: room.id });
    return response;
  }),
  post(
    '/api/v1/user/chat-rooms/direct',
    ({ body }) => {
      const existing = ROOMS.find(
        (r) =>
          (r.kind === 'DIRECT' || r.kind === 'REQUEST') &&
          r.counterpart?.id === Number(body.userId),
      );
      // Mutual follow / same team → room; otherwise a message request (POL-C-4).
      // A request needs `message`; without it nothing is created and roomId is null.
      if (existing) return { roomId: existing.id, kind: existing.kind };
      return typeof body.message === 'string' && body.message.trim()
        ? { roomId: 21, kind: 'REQUEST' }
        : { roomId: null, kind: 'REQUEST' };
    },
    { only: 'developer' },
  ),

  // `[Included]` AI summary (Flex): reduced DTO — one `summary` string, no share/minutes
  post('/api/v1/user/chat-rooms/:roomId/ai-summaries', ({ params, viewer }) => {
    const room = roomOr404(params.roomId!);
    const team = room.teamId ? findTeam(room.teamId) : undefined;
    if (team?.plan !== 'FLEX') {
      fail(403, 'PLAN_LIMIT', 'Flex 구독 팀만 쓸 수 있어요. 오너에게 Flex를 요청해 보세요.', {
        reason: 'AI_SUMMARY',
      });
    }
    const running = AI_SUMMARIES.find(
      (item) =>
        item.roomId === room.id &&
        item.userId === viewer.me!.id &&
        aiSummaryView(item).status === 'PENDING',
    );
    if (running) return aiSummaryView(running);
    const summary = {
      id: newId(),
      roomId: room.id,
      userId: viewer.me!.id,
      startedAt: Date.now(),
      sharedMessageId: null as number | null,
    };
    AI_SUMMARIES.push(summary);
    return aiSummaryView(summary);
  }),
  get('/api/v1/user/chat-rooms/:roomId/ai-summaries/:summaryId', ({ params }) =>
    aiSummaryView(aiSummaryOr404(params.summaryId!)),
  ),
  post('/api/v1/user/chat-rooms/:roomId/ai-summaries/:summaryId/share', ({ params, viewer }) => {
    const summary = aiSummaryOr404(params.summaryId!);
    const view = aiSummaryView(summary);
    if (view.status !== 'DONE') fail(409, 'STATE_CONFLICT', '요약이 끝난 뒤에 공유할 수 있어요');
    const existing = MESSAGES.find((item) => item.id === summary.sharedMessageId);
    if (existing) return withReadState(existing);
    const message = {
      id: nextMessageId(),
      roomId: summary.roomId,
      sender: brief(viewer.me!),
      type: 'AI_SUMMARY' as const,
      text: `AI 요약 · ${view.summary}`,
      imageUrls: [],
      payload: {
        summaryId: summary.id,
        summary: view.summary,
        messageCount: view.messageCount,
      },
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
    };
    MESSAGES.push(message);
    summary.sharedMessageId = message.id;
    const response = withReadState(message);
    emit(`/topic/chat-rooms/${summary.roomId}`, { event: 'MESSAGE', message: response });
    emit('/user/queue/chat-rooms', { event: 'MESSAGE', roomId: summary.roomId });
    return response;
  }),

  // Recruiter → developer. Reuses the pair when a room already exists and opens it.
  post('/api/v1/recruiter/chat-requests', ({ body }) => {
    const text = String(body.text ?? '');
    if (text.length > 1000) fail(400, 'TOO_LONG', '1,000자까지 보낼 수 있어요');
    const developer = DEVELOPERS.find((user) => user.id === Number(body.userId));
    if (!developer || isBlocked(developer.id)) fail(404, 'NOT_FOUND', '사용자를 찾을 수 없어요');
    const existing = ROOMS.find(
      (room) =>
        isRecruiterRoom(room.id) &&
        (room.kind === 'DIRECT' || room.kind === 'REQUEST') &&
        room.counterpart?.id === developer.id,
    );
    if (existing) {
      existing.kind = 'DIRECT';
      existing.requestDirection = null;
      const offer = OFFERS.find((item) => item.roomId === existing.id);
      if (offer) offer.status = 'TALKING';
      return { roomId: existing.id, kind: 'DIRECT' as const };
    }
    const roomId = newId();
    const sentAt = new Date().toISOString();
    ROOMS.push({
      id: roomId,
      kind: 'DIRECT',
      teamId: null,
      title: developer.name,
      counterpart: brief(developer),
      requestKind: 'RECRUITING',
      requestDirection: null,
      muted: false,
      memberCount: 2,
      createdAt: sentAt,
    });
    OFFERS.unshift({
      roomId,
      developer: brief(developer),
      status: 'TALKING',
      firstMessage: text,
      sentAt,
      techStack: developer.techStack,
      unavailable: false,
    });
    return { roomId, kind: 'DIRECT' as const };
  }),
];
