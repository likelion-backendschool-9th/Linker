import { daysAgo } from '../core/define';
import { brief, DEVELOPERS, ME, type UserBrief } from './users';

export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type TeamStatus = 'ACTIVE' | 'COMPLETED' | 'READ_ONLY' | 'ARCHIVED';

export type MockRepo = { id: number; name: string; fullName: string; private: boolean };

export type MockTeam = {
  id: number;
  name: string;
  description: string;
  orgLogin: string;
  orgAvatarUrl: string;
  status: TeamStatus;
  plan: 'FREE' | 'FLEX';
  /** The logged-in developer's role */
  myRole: TeamRole;
  chatRoomId: number;
  repos: MockRepo[];
  completedAt: string | null;
  createdAt: string;
};

export type MockMember = {
  user: UserBrief;
  role: TeamRole;
  joinedAt: string;
  /** Accepted the GitHub org invite; false = not assignable to issues yet (04 ch. 5) */
  inGithubOrg: boolean;
};

const orgAvatar = 'https://avatars.githubusercontent.com/u/9919?s=96';

export const TEAMS: MockTeam[] = [
  {
    id: 1,
    name: 'Linker 해커톤팀',
    description: '개발자 팀 찾기 서비스를 2주 안에 만들어요.',
    orgLogin: 'linker-hack',
    orgAvatarUrl: orgAvatar,
    status: 'ACTIVE',
    plan: 'FLEX',
    myRole: 'OWNER',
    chatRoomId: 1,
    repos: [
      { id: 11, name: 'linker-web', fullName: 'linker-hack/linker-web', private: false },
      { id: 12, name: 'linker-api', fullName: 'linker-hack/linker-api', private: false },
    ],
    completedAt: null,
    createdAt: daysAgo(30),
  },
  {
    id: 2,
    name: '오픈소스 스터디',
    description: '매주 오픈소스 하나를 골라 기여해 봐요.',
    orgLogin: 'oss-study-kr',
    orgAvatarUrl: orgAvatar,
    status: 'ACTIVE',
    plan: 'FREE',
    myRole: 'MEMBER',
    chatRoomId: 2,
    repos: [{ id: 21, name: 'study-notes', fullName: 'oss-study-kr/study-notes', private: false }],
    completedAt: null,
    createdAt: daysAgo(70),
  },
  {
    id: 3,
    name: '졸업작품 TF',
    description: '캡스톤 디자인 프로젝트 (완료).',
    orgLogin: 'capstone-tf',
    orgAvatarUrl: orgAvatar,
    status: 'COMPLETED',
    plan: 'FREE',
    myRole: 'ADMIN',
    chatRoomId: 3,
    repos: [{ id: 31, name: 'capstone-app', fullName: 'capstone-tf/capstone-app', private: false }],
    completedAt: daysAgo(12),
    createdAt: daysAgo(150),
  },
];

const [, doyun, seoyeon, minjae, hayun] = DEVELOPERS;

/** Members per team id */
export const TEAM_MEMBERS: Record<number, MockMember[]> = {
  1: [
    { user: brief(ME), role: 'OWNER', joinedAt: daysAgo(30), inGithubOrg: true },
    { user: brief(doyun!), role: 'ADMIN', joinedAt: daysAgo(29), inGithubOrg: true },
    { user: brief(seoyeon!), role: 'MEMBER', joinedAt: daysAgo(20), inGithubOrg: true },
    { user: brief(minjae!), role: 'MEMBER', joinedAt: daysAgo(10), inGithubOrg: true },
    { user: brief(hayun!), role: 'MEMBER', joinedAt: daysAgo(2), inGithubOrg: false },
  ],
  2: [
    { user: brief(doyun!), role: 'OWNER', joinedAt: daysAgo(70), inGithubOrg: true },
    { user: brief(ME), role: 'MEMBER', joinedAt: daysAgo(60), inGithubOrg: true },
    { user: brief(hayun!), role: 'MEMBER', joinedAt: daysAgo(40), inGithubOrg: true },
    { user: brief(minjae!), role: 'MEMBER', joinedAt: daysAgo(35), inGithubOrg: true },
  ],
  3: [
    { user: brief(seoyeon!), role: 'OWNER', joinedAt: daysAgo(150), inGithubOrg: true },
    { user: brief(ME), role: 'ADMIN', joinedAt: daysAgo(150), inGithubOrg: true },
    { user: brief(minjae!), role: 'MEMBER', joinedAt: daysAgo(149), inGithubOrg: true },
  ],
};

export function findTeam(id: string | number): MockTeam | undefined {
  return TEAMS.find((team) => team.id === Number(id));
}
