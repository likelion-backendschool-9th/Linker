import {
  daysAgo,
  get,
  hoursAgo,
  newId,
  patch,
  paginate,
  post,
  del,
  minutesAgo,
  type MockRoute,
} from '../core/define';

/** 18 Notifications: `NotificationController` */

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  /** Where tapping goes */
  targetUrl: string;
  read: boolean;
  createdAt: string;
};

const items: Notification[] = [
  {
    id: 1,
    type: 'CHAT',
    title: 'Linker 해커톤팀',
    body: '이도윤: 좋아요! 다음 회의는 내일 저녁에 해요.',
    targetUrl: '/chats/1',
    read: false,
    createdAt: minutesAgo(40),
  },
  {
    id: 2,
    type: 'ISSUE_ASSIGNED',
    title: '이슈가 배정됐어요',
    body: '#18 이슈 필터 시트 접근성 개선',
    targetUrl: '/teams/1/issues/1018',
    read: false,
    createdAt: hoursAgo(3),
  },
  {
    id: 3,
    type: 'MESSAGE_REQUEST',
    title: '채용 제안이 도착했어요',
    body: '넥스트랩 · 송지현',
    targetUrl: '/chats/20',
    read: false,
    createdAt: hoursAgo(5),
  },
  {
    id: 4,
    type: 'APPLICATION_RECEIVED',
    title: '새 지원이 들어왔어요',
    body: '윤태양님이 백엔드에 지원했어요',
    targetUrl: '/recruits/1',
    read: false,
    createdAt: daysAgo(2),
  },
  {
    id: 5,
    type: 'COMMENT',
    title: '댓글이 달렸어요',
    body: '박서연: 구조가 깔끔해서 참고하고 있어요',
    targetUrl: '/posts/1',
    read: true,
    createdAt: daysAgo(2),
  },
  {
    id: 6,
    type: 'FOLLOW',
    title: '새 팔로워',
    body: '정하윤님이 팔로우했어요',
    targetUrl: '/u/hayun-jung',
    read: true,
    createdAt: daysAgo(3),
  },
  {
    id: 7,
    type: 'APPLICATION_REJECTED',
    title: '지원 결과',
    body: '이번엔 함께하지 못하게 됐어요',
    targetUrl: '/recruits/4',
    read: true,
    createdAt: daysAgo(4),
  },
  {
    id: 8,
    type: 'DUE_SOON',
    title: '내일 마감이에요',
    body: '#9 웹훅 서명 검증 실패 시 500 반환',
    targetUrl: '/teams/1/issues/1009',
    read: true,
    createdAt: daysAgo(5),
  },
  {
    id: 9,
    type: 'JOB_STATUS_OFF',
    title: '구직 상태를 껐어요',
    body: '90일 동안 접속하지 않아 구직 상태가 꺼졌어요',
    targetUrl: '/settings/profile',
    read: true,
    createdAt: daysAgo(30),
  },
  // Sanction notice with the appeal entry (04 ch. 9)
  {
    id: 10,
    type: 'SANCTION',
    title: '운영 정책 안내',
    body: '운영 정책 위반으로 경고가 부여됐어요. 이의 제기하기',
    targetUrl: '/notifications',
    read: true,
    createdAt: daysAgo(45),
  },
];

export const routes: MockRoute[] = [
  get('/api/v1/user/notifications', ({ query }) => paginate(items, query)),
  get('/api/v1/user/notifications/unread-count', () => ({
    count: items.filter((n) => !n.read).length,
  })),
  patch('/api/v1/user/notifications/:notificationId/read', ({ params }) => {
    const item = items.find((n) => n.id === Number(params.notificationId));
    if (item) item.read = true;
    return undefined;
  }),
  post('/api/v1/user/notifications/read-all', () => {
    items.forEach((n) => (n.read = true));
    return undefined;
  }),
  post('/api/v1/user/appeals', () => ({ appealId: newId() })),
  post('/api/v1/user/push-tokens', () => undefined),
  del('/api/v1/user/push-tokens/:token', () => undefined),
];
