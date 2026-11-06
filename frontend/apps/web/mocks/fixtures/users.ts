import { daysAgo } from '../core/define';

export type JobStatus = 'SEEKING' | 'OPEN' | 'OFF';

export type UserBrief = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
  userType: 'DEVELOPER' | 'RECRUITER';
  /** Only SEEKING is public; OPEN is shown to recruiters (04 ch. 3) */
  jobStatus: JobStatus;
};

export type MockUser = UserBrief & {
  email: string;
  bio: string | null;
  blogUrl: string | null;
  techStack: string[];
  lookingForTeam: boolean;
  jobCategories: string[];
  isAdmin: boolean;
  followerCount: number;
  followingCount: number;
  /** POL-A-5 completion record */
  completion: { projectCount: number; issueCompletionRate: number };
  joinedAt: string;
  /** Recruiters only */
  company?: string;
  jobTitle?: string;
  companyEmailDomain?: string;
  websiteUrl?: string | null;
};

// GitHub's own octocat avatar for everyone; the host is allowed in next.config.ts
const avatar = 'https://avatars.githubusercontent.com/u/583231?s=96';

function developer(
  id: number,
  login: string,
  name: string,
  rest: Partial<MockUser> & Pick<MockUser, 'techStack'>,
): MockUser {
  return {
    id,
    login,
    name,
    avatarUrl: avatar,
    userType: 'DEVELOPER',
    jobStatus: 'OFF',
    email: `${login}@example.com`,
    bio: null,
    blogUrl: null,
    lookingForTeam: false,
    jobCategories: [],
    isAdmin: false,
    followerCount: 12,
    followingCount: 20,
    completion: { projectCount: 1, issueCompletionRate: 0.82 },
    joinedAt: daysAgo(120),
    ...rest,
  };
}

/** The logged-in developer (also the operator when the role is `operator`) */
export const ME = developer(1, 'seojun-han', '한서준', {
  bio: '프론트엔드 개발자. 작은 팀에서 끝까지 만드는 걸 좋아해요.',
  blogUrl: 'https://seojun.example.dev',
  techStack: ['TypeScript', 'React', 'Next.js', 'Node.js'],
  lookingForTeam: true,
  jobStatus: 'OPEN',
  jobCategories: ['FRONTEND', 'FULLSTACK'],
  followerCount: 48,
  followingCount: 31,
  completion: { projectCount: 3, issueCompletionRate: 0.91 },
});

export const DEVELOPERS: MockUser[] = [
  ME,
  developer(2, 'doyun-lee', '이도윤', {
    bio: '백엔드 개발자. Spring과 PostgreSQL을 주로 다뤄요.',
    techStack: ['Java', 'Spring Boot', 'PostgreSQL', 'Redis'],
    lookingForTeam: true,
    jobStatus: 'SEEKING',
    followerCount: 73,
    completion: { projectCount: 4, issueCompletionRate: 0.88 },
  }),
  developer(3, 'seoyeon-park', '박서연', {
    bio: '모바일 앱 개발자. Flutter로 사이드 프로젝트를 만들어요.',
    techStack: ['Flutter', 'Dart', 'Firebase'],
    lookingForTeam: true,
    followerCount: 35,
  }),
  developer(4, 'minjae-choi', '최민재', {
    bio: '데이터/AI 엔지니어.',
    techStack: ['Python', 'PyTorch', 'FastAPI'],
    jobStatus: 'OPEN',
    followerCount: 54,
  }),
  developer(5, 'hayun-jung', '정하윤', {
    bio: '디자이너 출신 프론트엔드 개발자.',
    techStack: ['React', 'TypeScript', 'Figma'],
    lookingForTeam: true,
    followerCount: 22,
  }),
  developer(6, 'jiwoo-kang', '강지우', {
    bio: 'DevOps · 인프라 자동화.',
    techStack: ['Docker', 'AWS', 'Go', 'Kubernetes'],
    followerCount: 61,
  }),
  developer(7, 'taeyang-yoon', '윤태양', {
    bio: '게임 클라이언트 개발자.',
    techStack: ['Unity', 'C#'],
    followerCount: 18,
  }),
  developer(8, 'serin-oh', '오세린', {
    bio: '보안과 QA에 관심 있는 신입 개발자.',
    techStack: ['Python', 'Selenium'],
    jobStatus: 'SEEKING',
    followerCount: 9,
  }),
];

/** The logged-in recruiter. Handle is `r-` + number (04 ch. 3 "Recruiter accounts") */
export const RECRUITER: MockUser = {
  id: 100,
  login: 'r-1001',
  name: '송지현',
  avatarUrl: avatar,
  userType: 'RECRUITER',
  jobStatus: 'OFF',
  email: 'jihyun.song@nextlab.example',
  bio: null,
  blogUrl: null,
  techStack: [],
  lookingForTeam: false,
  jobCategories: [],
  isAdmin: false,
  followerCount: 0,
  followingCount: 0,
  completion: { projectCount: 0, issueCompletionRate: 0 },
  joinedAt: daysAgo(40),
  company: '넥스트랩',
  jobTitle: '테크 리크루터',
  companyEmailDomain: 'nextlab.example',
  websiteUrl: 'https://nextlab.example',
};

export const ALL_USERS: MockUser[] = [...DEVELOPERS, RECRUITER];

export function brief(user: MockUser): UserBrief {
  const { id, login, name, avatarUrl, userType, jobStatus } = user;
  return { id, login, name, avatarUrl, userType, jobStatus };
}

export function findUser(login: string): MockUser | undefined {
  return ALL_USERS.find((user) => user.login === login);
}

export function findUserById(id: number): MockUser | undefined {
  return ALL_USERS.find((user) => user.id === id);
}

/** Developers other than the logged-in one */
export const OTHERS = DEVELOPERS.filter((user) => user.id !== ME.id);
