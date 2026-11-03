import { daysAgo, hoursAgo, minutesAgo } from '../core/define';
import { TEAMS } from './teams';
import { brief, DEVELOPERS, ME, RECRUITER, type UserBrief } from './users';

export type MessageType =
  'TEXT' | 'IMAGE' | 'ISSUE_CARD' | 'PR_EVENT' | 'SHARE_CARD' | 'AI_SUMMARY' | 'SYSTEM';

export type MockMessage = {
  clientMessageId?: string;
  id: number;
  roomId: number;
  /** null for system and PR messages */
  sender: UserBrief | null;
  type: MessageType;
  text: string | null;
  imageUrls: string[];
  /** Card data for ISSUE_CARD / PR_EVENT / SHARE_CARD / AI_SUMMARY */
  payload: Record<string, unknown> | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type RoomKind = 'TEAM' | 'DIRECT' | 'REQUEST';

export type MockRoom = {
  id: number;
  kind: RoomKind;
  /** Team id for TEAM rooms */
  teamId: number | null;
  title: string;
  /** The other person for DIRECT and REQUEST */
  counterpart: UserBrief | null;
  /** REQUEST from a recruiter (04 POL-H-3) */
  requestKind: 'NORMAL' | 'RECRUITING' | null;
  /** From my side: sent by me, or waiting for my answer */
  requestDirection: 'SENT' | 'RECEIVED' | null;
  muted: boolean;
  memberCount: number;
  createdAt: string;
};

const [, doyun, seoyeon, minjae, hayun] = DEVELOPERS;

export const ROOMS: MockRoom[] = [
  {
    id: 1,
    kind: 'TEAM',
    teamId: 1,
    title: TEAMS[0]!.name,
    counterpart: null,
    requestKind: null,
    requestDirection: null,
    muted: false,
    memberCount: 5,
    createdAt: daysAgo(30),
  },
  {
    id: 2,
    kind: 'TEAM',
    teamId: 2,
    title: TEAMS[1]!.name,
    counterpart: null,
    requestKind: null,
    requestDirection: null,
    muted: true,
    memberCount: 4,
    createdAt: daysAgo(70),
  },
  {
    id: 3,
    kind: 'TEAM',
    teamId: 3,
    title: TEAMS[2]!.name,
    counterpart: null,
    requestKind: null,
    requestDirection: null,
    muted: false,
    memberCount: 3,
    createdAt: daysAgo(150),
  },
  {
    id: 10,
    kind: 'DIRECT',
    teamId: null,
    title: doyun!.name,
    counterpart: brief(doyun!),
    requestKind: null,
    requestDirection: null,
    muted: false,
    memberCount: 2,
    createdAt: daysAgo(20),
  },
  {
    id: 11,
    kind: 'DIRECT',
    teamId: null,
    title: seoyeon!.name,
    counterpart: brief(seoyeon!),
    requestKind: null,
    requestDirection: null,
    muted: false,
    memberCount: 2,
    createdAt: daysAgo(9),
  },
  {
    id: 20,
    kind: 'REQUEST',
    teamId: null,
    title: RECRUITER.name,
    counterpart: brief(RECRUITER),
    requestKind: 'RECRUITING',
    requestDirection: 'RECEIVED',
    muted: false,
    memberCount: 2,
    createdAt: hoursAgo(5),
  },
  {
    id: 21,
    kind: 'REQUEST',
    teamId: null,
    title: minjae!.name,
    counterpart: brief(minjae!),
    requestKind: 'NORMAL',
    requestDirection: 'RECEIVED',
    muted: false,
    memberCount: 2,
    createdAt: daysAgo(1),
  },
  {
    id: 22,
    kind: 'REQUEST',
    teamId: null,
    title: hayun!.name,
    counterpart: brief(hayun!),
    requestKind: 'NORMAL',
    requestDirection: 'SENT',
    muted: false,
    memberCount: 2,
    createdAt: daysAgo(2),
  },
];

let messageId = 100;
function msg(
  roomId: number,
  rest: Partial<MockMessage> & Pick<MockMessage, 'createdAt'>,
): MockMessage {
  return {
    id: messageId++,
    roomId,
    sender: null,
    type: 'TEXT',
    text: null,
    imageUrls: [],
    payload: null,
    editedAt: null,
    deletedAt: null,
    ...rest,
  };
}

const me = brief(ME);

/** Messages per room, oldest first */
export const MESSAGES: MockMessage[] = [
  msg(1, {
    sender: brief(doyun!),
    text: '오늘 스탠드업 10시에 시작할게요!',
    createdAt: hoursAgo(26),
  }),
  msg(1, {
    sender: me,
    text: '확인했어요. 로그인 시트는 오늘 안에 올릴게요.',
    createdAt: hoursAgo(25),
  }),
  msg(1, {
    type: 'PR_EVENT',
    text: 'PR #31 "feat: 로그인 시트" 가 열렸어요',
    payload: {
      prNumber: 31,
      repo: 'linker-hack/linker-web',
      event: 'OPENED',
      url: 'https://github.com/linker-hack/linker-web/pull/31',
    },
    createdAt: hoursAgo(24),
  }),
  msg(1, {
    sender: brief(seoyeon!),
    text: '리뷰 남겼어요. @한서준 확인 부탁해요',
    createdAt: hoursAgo(20),
  }),
  msg(1, {
    sender: me,
    type: 'ISSUE_CARD',
    text: '#15 이거 오늘 끝낼 수 있을 것 같아요',
    payload: {
      issueRefs: [{ number: 15, repoId: 11 }],
    },
    createdAt: hoursAgo(6),
  }),
  msg(1, {
    sender: brief(minjae!),
    text: '사진 공유드려요',
    imageUrls: ['/mock/cover-1.svg', '/mock/cover-2.svg'],
    createdAt: hoursAgo(3),
  }),
  msg(1, {
    sender: brief(doyun!),
    text: '좋아요! 다음 회의는 내일 저녁에 해요.',
    createdAt: minutesAgo(40),
  }),
  msg(2, {
    sender: brief(doyun!),
    text: '이번 주는 React 소스 읽어 볼게요.',
    createdAt: daysAgo(2),
  }),
  msg(2, { sender: me, text: '좋아요, 저는 스케줄러 쪽 볼게요.', createdAt: daysAgo(2) }),
  msg(3, { type: 'SYSTEM', text: '프로젝트가 완료 처리됐어요.', createdAt: daysAgo(12) }),
  msg(10, {
    sender: brief(doyun!),
    text: '혹시 이번 주말에 시간 되세요?',
    createdAt: hoursAgo(30),
  }),
  msg(10, { sender: me, text: '토요일 오후면 괜찮아요.', createdAt: hoursAgo(29) }),
  msg(10, {
    sender: brief(doyun!),
    type: 'SHARE_CARD',
    text: null,
    payload: {
      targetType: 'POST',
      targetId: 2,
      title: 'Spring Boot로 만든 STOMP 채팅 서버',
      subtitle: '이도윤',
    },
    createdAt: hoursAgo(28),
  }),
  msg(11, {
    sender: brief(seoyeon!),
    text: '앱 쪽 프론트엔드 도움이 필요해서 연락드렸어요.',
    createdAt: daysAgo(9),
  }),
  msg(11, { sender: me, text: '어떤 부분인지 자세히 알려주세요!', createdAt: daysAgo(9) }),
  msg(20, {
    sender: brief(RECRUITER),
    text: '안녕하세요, 넥스트랩 테크 리크루터 송지현입니다. 프론트엔드 포지션 관련해 프로필을 보고 연락드렸어요. 관심 있으시면 편하게 답장 주세요.',
    createdAt: hoursAgo(5),
  }),
  msg(21, {
    sender: brief(minjae!),
    text: '공모전 같이 나가실 생각 있으세요?',
    createdAt: daysAgo(1),
  }),
  msg(22, {
    sender: me,
    text: '디자인 쪽 이야기를 나누고 싶어서 먼저 연락드려요.',
    createdAt: daysAgo(2),
  }),
];

export function lastMessage(roomId: number) {
  return [...MESSAGES].reverse().find((item) => item.roomId === roomId && !item.deletedAt) ?? null;
}

export function findRoom(id: string | number) {
  return ROOMS.find((room) => room.id === Number(id));
}

/** Unread counts per room for the logged-in developer */
export const UNREAD: Record<number, number> = {
  1: 3,
  2: 0,
  3: 0,
  10: 1,
  11: 0,
  20: 1,
  21: 1,
  22: 0,
};

export function nextMessageId() {
  return messageId++;
}
