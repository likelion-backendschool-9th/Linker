import type { RecruitRoleKey } from '@/features/recruit/recruit-labels';

import { dateOnly, daysAgo, hoursAgo } from '../core/define';
import { brief, DEVELOPERS, ME, type UserBrief } from './users';

/** `role` = ERD `recruit_roles.role` key (19 filter), `name` = its label */
export type RecruitRole = {
  id: number;
  role: RecruitRoleKey;
  name: string;
  headcount: number;
  filled: number;
};

export type MockRecruit = {
  id: number;
  author: UserBrief;
  /** Linked team (owner/admin only); null = no team yet */
  teamId: number | null;
  title: string;
  intro: string;
  format: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  region: string | null;
  goal: 'CONTEST' | 'HACKATHON' | 'LAUNCH' | 'LEARNING' | null;
  duration: string | null;
  deadline: string;
  status: 'OPEN' | 'CLOSED';
  techTags: string[];
  roles: RecruitRole[];
  createdAt: string;
};

export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export type MockApplication = {
  id: number;
  recruitId: number;
  applicant: UserBrief;
  roleId: number;
  message: string;
  status: ApplicationStatus;
  appliedAt: string;
  /** Days until the 14-day auto expiry (POL-R-4) */
  daysLeft: number;
};

const [, doyun, seoyeon, minjae, hayun, jiwoo, taeyang, serin] = DEVELOPERS;

export const RECRUITS: MockRecruit[] = [
  {
    id: 1,
    author: brief(ME),
    teamId: 1,
    title: 'Linker 해커톤팀 백엔드/디자이너 모집',
    intro:
      '2주 뒤 데모데이를 목표로 하는 팀이에요.\n주 3회 온라인 스탠드업, 나머지는 비동기로 진행해요.',
    format: 'ONLINE',
    region: null,
    goal: 'HACKATHON',
    duration: '2주',
    deadline: dateOnly(5),
    status: 'OPEN',
    techTags: ['Next.js', 'Spring Boot', 'PostgreSQL'],
    roles: [
      { id: 11, role: 'BACKEND', name: '백엔드', headcount: 2, filled: 1 },
      { id: 12, role: 'DESIGN', name: '디자이너', headcount: 1, filled: 0 },
    ],
    createdAt: daysAgo(3),
  },
  {
    id: 2,
    author: brief(doyun!),
    teamId: 2,
    title: '오픈소스 기여 스터디원 모집 (서울 강남)',
    intro: '매주 토요일 오프라인으로 만나 같이 PR을 올려요.',
    format: 'OFFLINE',
    region: '서울 강남',
    goal: 'LEARNING',
    duration: '3개월',
    deadline: dateOnly(12),
    status: 'OPEN',
    techTags: ['TypeScript', 'Go'],
    roles: [{ id: 21, role: 'FRONTEND', name: '프론트엔드', headcount: 3, filled: 1 }],
    createdAt: daysAgo(6),
  },
  {
    id: 3,
    author: brief(seoyeon!),
    teamId: null,
    title: 'Flutter 앱 사이드 프로젝트 팀원',
    // Longer than the 19 card preview (200), so the list shows "...자세히 보기"
    intro:
      '출시까지 같이 갈 분을 찾아요. 아직 팀은 만들지 않았어요. 연극·뮤지컬·무용·국악·콘서트 같은 공연 정보를 공연장과 예매처마다 따로 찾지 않고 한 번에 모아 보는 앱을 만들고 있어요. 관심 공연을 저장하면 예매 오픈과 공연 일정을 캘린더로 알려 주고, 함께 갈 친구에게 공유할 수도 있어요. 기획과 디자인 초안은 나와 있고, Flutter로 첫 화면을 만들어 두었어요. 주 1회 서울에서 오프라인으로 만나고 나머지는 온라인으로 진행해요. 출시 후에도 같이 운영할 분이면 더 좋아요.',
    format: 'HYBRID',
    region: '서울',
    goal: 'LAUNCH',
    duration: '2개월',
    deadline: dateOnly(20),
    status: 'OPEN',
    techTags: ['Flutter', 'Firebase'],
    roles: [
      { id: 31, role: 'MOBILE', name: '앱 개발', headcount: 2, filled: 0 },
      { id: 32, role: 'BACKEND', name: '백엔드', headcount: 1, filled: 1 },
    ],
    createdAt: daysAgo(1),
  },
  {
    id: 4,
    author: brief(minjae!),
    teamId: null,
    title: 'AI 공모전 같이 나가실 분',
    intro: '이번 달 말 마감하는 공모전이에요. 데이터 처리와 프론트가 필요해요.',
    format: 'ONLINE',
    region: null,
    goal: 'CONTEST',
    duration: '3주',
    deadline: dateOnly(1),
    status: 'OPEN',
    techTags: ['Python', 'React'],
    roles: [
      { id: 41, role: 'FRONTEND', name: '프론트엔드', headcount: 1, filled: 0 },
      { id: 42, role: 'DATA_AI', name: '데이터 엔지니어', headcount: 1, filled: 0 },
    ],
    createdAt: hoursAgo(30),
  },
  {
    id: 5,
    author: brief(jiwoo!),
    teamId: null,
    title: '인프라 자동화 스터디 (마감)',
    intro: '모집이 끝난 글이에요.',
    format: 'ONLINE',
    region: null,
    goal: 'LEARNING',
    duration: '4주',
    deadline: dateOnly(-3),
    status: 'CLOSED',
    techTags: ['Docker', 'Kubernetes', 'AWS'],
    roles: [{ id: 51, role: 'ETC', name: '스터디원', headcount: 4, filled: 4 }],
    createdAt: daysAgo(20),
  },
  {
    // Team 1 post by its admin (not the logged-in developer): 21 as a non-author team member
    id: 6,
    author: brief(doyun!),
    teamId: 1,
    title: 'Linker 팀 프론트엔드 1명 추가 모집',
    intro: '데모데이 전에 화면 작업을 같이 마무리할 분을 찾아요.',
    format: 'ONLINE',
    region: null,
    goal: 'LAUNCH',
    duration: '2주',
    deadline: dateOnly(10),
    status: 'OPEN',
    techTags: ['Next.js', 'TypeScript'],
    roles: [{ id: 61, role: 'FRONTEND', name: '프론트엔드', headcount: 1, filled: 0 }],
    createdAt: hoursAgo(5),
  },
];

/** Applications by recruit; the logged-in developer applied to recruit 2 and 4 */
export const APPLICATIONS: MockApplication[] = [
  {
    id: 1,
    recruitId: 1,
    applicant: brief(taeyang!),
    roleId: 11,
    message: 'Spring으로 채팅 서버를 만들어 본 경험이 있어요. 해커톤 일정에 맞출 수 있어요.',
    status: 'PENDING',
    appliedAt: daysAgo(2),
    daysLeft: 12,
  },
  {
    id: 2,
    recruitId: 1,
    applicant: brief(serin!),
    roleId: 12,
    message: '디자인 시스템 작업을 해 봤고 Figma를 잘 써요.',
    status: 'PENDING',
    appliedAt: daysAgo(1),
    daysLeft: 13,
  },
  {
    id: 3,
    recruitId: 1,
    applicant: brief(hayun!),
    roleId: 12,
    message: '지난 프로젝트에서 디자이너 겸 프론트를 맡았어요.',
    status: 'ACCEPTED',
    appliedAt: daysAgo(6),
    daysLeft: 0,
  },
  {
    id: 4,
    recruitId: 2,
    applicant: brief(ME),
    roleId: 21,
    message: '평일 저녁과 주말 모두 가능해요.',
    status: 'PENDING',
    appliedAt: daysAgo(3),
    daysLeft: 11,
  },
  {
    id: 5,
    recruitId: 4,
    applicant: brief(ME),
    roleId: 41,
    message: '데이터 시각화 경험이 있어요.',
    status: 'REJECTED',
    appliedAt: daysAgo(5),
    daysLeft: 0,
  },
  {
    id: 6,
    recruitId: 3,
    applicant: brief(ME),
    roleId: 31,
    message: 'Flutter는 처음이지만 빨리 배워요.',
    status: 'EXPIRED',
    appliedAt: daysAgo(16),
    daysLeft: 0,
  },
];

export function findRecruit(id: string | number) {
  return RECRUITS.find((item) => item.id === Number(id));
}

export function recruitCard(item: MockRecruit) {
  return {
    id: item.id,
    title: item.title,
    intro: item.intro,
    author: item.author,
    format: item.format,
    region: item.region,
    goal: item.goal,
    deadline: item.deadline,
    status: item.status,
    techTags: item.techTags,
    roles: item.roles.map((role) => ({ ...role, remaining: role.headcount - role.filled })),
    createdAt: item.createdAt,
  };
}
