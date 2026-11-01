import { daysAgo, hoursAgo } from '../core/define';
import { brief, DEVELOPERS, ME, type UserBrief } from './users';

export type MockRepoCard = {
  repoId: number;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  isFork: boolean;
  /** PUBLIC; PRIVATE_OR_DELETED shows "레포를 볼 수 없음" (POL-P-1) */
  state: 'PUBLIC' | 'PRIVATE_OR_DELETED';
  /** "내 커밋 N개" for the author; 0 also when the commit email isn't registered (POL-P-2) */
  authorCommitCount: number;
  handledIssueCount: number;
};

export type MockPost = {
  id: number;
  author: UserBrief;
  intro: string;
  body: string;
  repo: MockRepoCard;
  /** Images under /public/mock; the first is the cover */
  photos: string[];
  myRole: string | null;
  demoLinks: string[];
  period: { start: string; end: string } | null;
  teamSize: number | null;
  tags: string[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  /** Visible to the author only when hidden by reports */
  visibility: 'VISIBLE' | 'UNDER_REVIEW';
  createdAt: string;
  editedAt: string | null;
};

const [, doyun, seoyeon, minjae, hayun, jiwoo] = DEVELOPERS;

function repoCard(fullName: string, rest: Partial<MockRepoCard> = {}): MockRepoCard {
  return {
    repoId: Math.abs(fullName.length * 97),
    fullName,
    description: 'GitHub 레포 설명이 여기에 들어가요.',
    language: 'TypeScript',
    stars: 12,
    forks: 3,
    isFork: false,
    state: 'PUBLIC',
    authorCommitCount: 84,
    handledIssueCount: 17,
    ...rest,
  };
}

export const POSTS: MockPost[] = [
  {
    id: 1,
    author: brief(ME),
    intro: '개발자 팀 찾기부터 협업까지, Linker 웹 클라이언트',
    body: '2주 해커톤에서 만든 서비스예요.\nNext.js 16과 CSS Modules로 만들었고, 접근성 검사를 CI에 넣었어요.\n\n데모: https://linker.example.dev',
    repo: repoCard('linker-hack/linker-web', {
      description: 'Linker 웹 (Next.js)',
      stars: 28,
      forks: 4,
      handledIssueCount: 34,
    }),
    photos: ['/mock/cover-1.svg', '/mock/cover-2.svg'],
    myRole: '프론트엔드 개발',
    demoLinks: ['https://linker.example.dev'],
    period: { start: '2026-10', end: '2026-11' },
    teamSize: 5,
    tags: ['Next.js', 'TypeScript', '접근성'],
    likeCount: 42,
    commentCount: 6,
    viewCount: 812,
    visibility: 'VISIBLE',
    createdAt: daysAgo(2),
    editedAt: null,
  },
  {
    id: 2,
    author: brief(doyun!),
    intro: 'Spring Boot로 만든 STOMP 채팅 서버',
    body: '재연결 시 놓친 메시지를 REST로 다시 받아오는 구조예요.\n읽음 처리와 안 읽은 수 집계도 포함했어요.',
    repo: repoCard('doyun-lee/stomp-chat', {
      description: 'Spring STOMP 채팅 예제',
      language: 'Java',
      stars: 95,
      forks: 21,
    }),
    photos: ['/mock/cover-3.svg'],
    myRole: '백엔드 개발',
    demoLinks: [],
    period: { start: '2026-08', end: '2026-09' },
    teamSize: 2,
    tags: ['Spring Boot', 'STOMP', 'Redis'],
    likeCount: 67,
    commentCount: 9,
    viewCount: 1430,
    visibility: 'VISIBLE',
    createdAt: daysAgo(5),
    editedAt: daysAgo(4),
  },
  {
    id: 3,
    author: brief(seoyeon!),
    intro: 'Flutter 가계부 앱',
    body: '영수증 사진을 찍으면 항목을 자동으로 분류해 줘요.',
    repo: repoCard('seoyeon-park/ledger-app', {
      description: '가계부 앱',
      language: 'Dart',
      stars: 31,
      authorCommitCount: 0,
    }),
    photos: [],
    myRole: null,
    demoLinks: ['https://play.example.dev/ledger'],
    period: null,
    teamSize: 1,
    tags: ['Flutter', 'Firebase'],
    likeCount: 15,
    commentCount: 2,
    viewCount: 240,
    visibility: 'VISIBLE',
    createdAt: daysAgo(8),
    editedAt: null,
  },
  {
    id: 4,
    author: brief(minjae!),
    intro: '논문 요약 RAG 챗봇',
    body: 'PDF 논문을 올리면 섹션별로 요약하고 질문에 답해요.',
    repo: repoCard('minjae-choi/paper-rag', {
      description: 'RAG 기반 논문 요약',
      language: 'Python',
      stars: 120,
      forks: 18,
      isFork: false,
      // Made private after posting: the card says "레포를 볼 수 없음" (POL-P-1)
      state: 'PRIVATE_OR_DELETED',
    }),
    photos: ['/mock/cover-2.svg'],
    myRole: '모델링',
    demoLinks: [],
    period: { start: '2026-06', end: '2026-08' },
    teamSize: 3,
    tags: ['Python', 'FastAPI', 'RAG'],
    likeCount: 88,
    commentCount: 11,
    viewCount: 2210,
    visibility: 'VISIBLE',
    createdAt: daysAgo(12),
    editedAt: null,
  },
  {
    id: 5,
    author: brief(hayun!),
    intro: '디자인 토큰 → CSS 변수 변환 CLI',
    body: 'Figma 변수를 내보내서 CSS 커스텀 프로퍼티로 바꿔 줘요.',
    repo: repoCard('hayun-jung/token-cli', {
      description: 'Figma 토큰 변환 CLI',
      language: 'TypeScript',
      stars: 9,
      isFork: true,
    }),
    photos: ['/mock/cover-1.svg'],
    myRole: '개발',
    demoLinks: [],
    period: null,
    teamSize: 1,
    tags: ['TypeScript', 'Figma'],
    likeCount: 5,
    commentCount: 0,
    viewCount: 96,
    visibility: 'VISIBLE',
    createdAt: hoursAgo(20),
    editedAt: null,
  },
  {
    id: 6,
    author: brief(jiwoo!),
    intro: '쿠버네티스 배포 자동화 템플릿',
    body: 'Helm 차트와 GitHub Actions를 한 번에 설정해 줘요.',
    repo: repoCard('jiwoo-kang/k8s-starter', {
      description: 'K8s 배포 템플릿',
      language: 'Go',
      stars: 210,
      forks: 40,
      state: 'PRIVATE_OR_DELETED',
    }),
    photos: [],
    myRole: '인프라',
    demoLinks: [],
    period: null,
    teamSize: 1,
    tags: ['Kubernetes', 'Go', 'Docker'],
    likeCount: 30,
    commentCount: 3,
    viewCount: 540,
    visibility: 'VISIBLE',
    createdAt: daysAgo(15),
    editedAt: null,
  },
];

export function findPost(id: string | number) {
  return POSTS.find((post) => post.id === Number(id));
}

/** Feed/list shape: no body, a cover and counts */
export function postCard(post: MockPost) {
  return {
    id: post.id,
    author: post.author,
    intro: post.intro,
    coverUrl: post.photos[0] ?? null,
    repoFullName: post.repo.fullName,
    language: post.repo.language,
    tags: post.tags,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    editedAt: post.editedAt,
    repoAvailable: post.repo.state === 'PUBLIC',
  };
}
