import { daysAgo, get, hoursAgo, type MockRoute } from '../core/define';
import { MESSAGES, ROOMS, UNREAD, type MockMessage, type MockRoom } from '../fixtures/chat';
import { brief, DEVELOPERS, RECRUITER } from '../fixtures/users';

/**
 * 33 Sent offers list: `RecruiterOfferController`. A recruiting offer is a 1:1 chat request (04 POL-H-3),
 * so each offer owns a room; rooms 30+ belong to the recruiter and are hidden from developers (see p16).
 */

const [, doyun, , minjae, , , , serin] = DEVELOPERS;

export type OfferStatus = 'TALKING' | 'WAITING' | 'NO_RESPONSE';

type Offer = {
  roomId: number;
  developer: ReturnType<typeof brief> | null;
  status: OfferStatus;
  firstMessage: string;
  sentAt: string;
  techStack: string[];
  /** Blocked or withdrawn counterpart shows as "볼 수 없는 사용자" */
  unavailable: boolean;
};

const first = (text: string) => text;

export const OFFERS: Offer[] = [
  {
    roomId: 30,
    developer: brief(doyun!),
    status: 'TALKING',
    firstMessage: first('안녕하세요, 넥스트랩 송지현입니다. 백엔드 포지션 관련해 연락드렸어요.'),
    sentAt: daysAgo(6),
    techStack: doyun!.techStack.slice(0, 3),
    unavailable: false,
  },
  {
    roomId: 31,
    developer: brief(minjae!),
    status: 'WAITING',
    firstMessage: first('프로필에서 RAG 프로젝트를 인상 깊게 봤어요. 이야기 나눌 수 있을까요?'),
    sentAt: daysAgo(2),
    techStack: minjae!.techStack.slice(0, 3),
    unavailable: false,
  },
  {
    roomId: 32,
    developer: brief(serin!),
    status: 'WAITING',
    firstMessage: first('QA 직무 신입 채용 관련해 연락드립니다.'),
    sentAt: hoursAgo(20),
    techStack: serin!.techStack.slice(0, 3),
    unavailable: false,
  },
  {
    roomId: 33,
    developer: null,
    status: 'NO_RESPONSE',
    firstMessage: first('프론트엔드 포지션 제안드립니다.'),
    sentAt: daysAgo(40),
    techStack: [],
    unavailable: true,
  },
];

// Rooms and messages the recruiter sees in chat (16, 17)
const recruiterRooms: MockRoom[] = OFFERS.filter((o) => o.developer).map((offer) => ({
  id: offer.roomId,
  kind: offer.status === 'TALKING' ? 'DIRECT' : 'REQUEST',
  teamId: null,
  title: offer.developer!.name,
  counterpart: offer.developer,
  requestKind: 'RECRUITING',
  requestDirection: offer.status === 'TALKING' ? null : 'SENT',
  muted: false,
  memberCount: 2,
  createdAt: offer.sentAt,
}));
ROOMS.push(...recruiterRooms);

const recruiterMessages: MockMessage[] = OFFERS.filter((o) => o.developer).map((offer, index) => ({
  id: 900 + index,
  roomId: offer.roomId,
  sender: brief(RECRUITER),
  type: 'TEXT',
  text: offer.firstMessage,
  imageUrls: [],
  payload: null,
  createdAt: offer.sentAt,
  editedAt: null,
  deletedAt: null,
}));
MESSAGES.push(...recruiterMessages, {
  id: 910,
  roomId: 30,
  sender: brief(doyun!),
  type: 'TEXT',
  text: '연락 감사합니다. 근무 형태가 어떻게 되나요?',
  imageUrls: [],
  payload: null,
  createdAt: daysAgo(5),
  editedAt: null,
  deletedAt: null,
});
Object.assign(UNREAD, { 30: 1, 31: 0, 32: 0 });

export const isRecruiterRoom = (roomId: number) => roomId >= 30;

const DAILY_LIMIT = { used: 3, limit: 10 };

export const routes: MockRoute[] = [
  get('/api/v1/recruiter/offers', ({ query }) => {
    const status = query.get('status') as OfferStatus | null;
    // Rejection is never disclosed: it shows as WAITING, then NO_RESPONSE (POL-H-3)
    return {
      items: OFFERS.filter((offer) => !status || offer.status === status).map((offer) => ({
        roomId: offer.roomId,
        status: offer.status,
        developer: offer.developer,
        unavailable: offer.unavailable,
        techStack: offer.techStack,
        firstMessage: offer.firstMessage,
        sentAt: offer.sentAt,
      })),
    };
  }),
  get('/api/v1/recruiter/offers/counts', () => ({
    TALKING: OFFERS.filter((o) => o.status === 'TALKING').length,
    WAITING: OFFERS.filter((o) => o.status === 'WAITING').length,
    NO_RESPONSE: OFFERS.filter((o) => o.status === 'NO_RESPONSE').length,
  })),
  // Borrowed by 04's recruiter my page
  get('/api/v1/recruiter/offers/summary', () => ({
    talkingCount: OFFERS.filter((o) => o.status === 'TALKING').length,
    waitingCount: OFFERS.filter((o) => o.status === 'WAITING').length,
    todayUsed: DAILY_LIMIT.used,
    todayLimit: DAILY_LIMIT.limit,
    scoutTodayLimit: 50,
    scoutSubscribed: true,
    latest: OFFERS.slice(0, 3).map((o) => ({
      roomId: o.roomId,
      developer: o.developer,
      status: o.status,
      sentAt: o.sentAt,
    })),
  })),
  get('/api/v1/recruiter/offers/:roomId/first-message', ({ params }) => {
    const offer = OFFERS.find((o) => o.roomId === Number(params.roomId));
    return {
      roomId: Number(params.roomId),
      text: offer?.firstMessage ?? '',
      sentAt: offer?.sentAt ?? null,
    };
  }),
];
