import { del, fail, get, paginate, post, type MockRoute } from '../core/define';
import { findRoom, lastMessage, ROOMS, UNREAD, type MockRoom } from '../fixtures/chat';
import { isRecruiterRoom } from './p33-recruiter-offers';

/** 16 Chat list: `ChatController`. Recruiters see only the rooms from their offers (04 ch. 2). */

const mineFor = (role: string) =>
  ROOMS.filter((room) =>
    role === 'recruiter' ? isRecruiterRoom(room.id) : !isRecruiterRoom(room.id),
  );

export function roomRow(room: MockRoom) {
  const last = lastMessage(room.id);
  return {
    id: room.id,
    kind: room.kind,
    title: room.title,
    counterpart: room.counterpart,
    // "채용 제안" label + company name (04 POL-H-3)
    requestKind: room.requestKind,
    requestDirection: room.requestDirection,
    companyName: room.requestKind === 'RECRUITING' ? '넥스트랩' : null,
    muted: room.muted,
    unreadCount: UNREAD[room.id] ?? 0,
    lastMessage: last
      ? {
          text: last.deletedAt ? '삭제된 메시지입니다' : (last.text ?? '사진을 보냈어요'),
          createdAt: last.createdAt,
        }
      : null,
  };
}

export const routes: MockRoute[] = [
  get('/api/v1/user/chat-rooms', ({ query, viewer }) => {
    const tab = query.get('tab') ?? 'TEAM';
    const rooms = mineFor(viewer.role).filter((room) =>
      // Recruiters have the DIRECT tab only; accepted offers are DIRECT, waiting ones REQUEST
      tab === 'DIRECT' && viewer.role === 'recruiter' ? true : room.kind === tab,
    );
    const sorted = rooms
      .map(roomRow)
      .sort((a, b) =>
        (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''),
      );
    return paginate(sorted, query);
  }),
  get('/api/v1/user/chat-rooms/unread-summary', ({ viewer }) => {
    const rooms = mineFor(viewer.role);
    const sum = (kind: MockRoom['kind']) =>
      rooms.filter((r) => r.kind === kind).reduce((total, r) => total + (UNREAD[r.id] ?? 0), 0);
    return {
      TEAM: sum('TEAM'),
      DIRECT: sum('DIRECT'),
      REQUEST: sum('REQUEST'),
      requestCount: rooms.filter((r) => r.kind === 'REQUEST' && r.requestDirection === 'RECEIVED')
        .length,
      total: rooms.reduce((total, r) => total + (UNREAD[r.id] ?? 0), 0),
    };
  }),
  // Also borrowed by the top of 17
  post('/api/v1/user/chat-requests/:roomId/accept', ({ params }) => {
    const room = findRoom(params.roomId!);
    if (!room || room.kind !== 'REQUEST') fail(404, 'NOT_FOUND', '요청을 찾지 못했어요');
    room.kind = 'DIRECT';
    room.requestDirection = null;
    return { roomId: room.id };
  }),
  // Reject: the sender isn't told, and can't ask again for 30 days (POL-C-4)
  del('/api/v1/user/chat-requests/:roomId', ({ params }) => {
    const index = ROOMS.findIndex((room) => room.id === Number(params.roomId));
    if (index >= 0) ROOMS.splice(index, 1);
    return undefined;
  }),
];
