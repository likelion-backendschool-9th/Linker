import { dateOnly, daysAgo } from '../core/define';
import { brief, DEVELOPERS, ME, type UserBrief } from './users';

/** 04 POL-I-3: Todo / In Progress / Blocked / Done, plus OTHER for unmapped board columns */
export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'OTHER';

export type MockIssue = {
  id: number;
  teamId: number;
  number: number;
  repoId: number;
  repoName: string;
  title: string;
  /** Sanitized Markdown (04 ch. 7) */
  body: string;
  status: IssueStatus;
  /** GitHub state; DONE ⇔ closed */
  state: 'OPEN' | 'CLOSED';
  assignees: UserBrief[];
  labels: { name: string; color: string }[];
  startDate: string | null;
  dueDate: string | null;
  /** In the Projects board; false → shows under "일정 없음" */
  inProject: boolean;
  author: UserBrief;
  commentCount: number;
  githubUrl: string;
  createdAt: string;
  updatedAt: string;
  /** Sub-issue progress (`[Included]`) */
  subIssues: { total: number; done: number };
};

export const LABELS = [
  { name: 'bug', color: '#d73a4a' },
  { name: 'feature', color: '#0e8a16' },
  { name: 'design', color: '#a2eeef' },
  { name: 'docs', color: '#0075ca' },
  { name: 'help wanted', color: '#008672' },
];
const label = (name: string) => LABELS.find((item) => item.name === name)!;

// jiwoo is not in team 1: an assignee who left the team (04 ch. 7 exceptions, "팀 밖 사용자")
const [, doyun, seoyeon, minjae, hayun, jiwoo] = DEVELOPERS;
const me = brief(ME);
const d = (u: (typeof DEVELOPERS)[number] | undefined) => brief(u!);

type Seed = Pick<MockIssue, 'number' | 'title' | 'status'> &
  Partial<Omit<MockIssue, 'number' | 'title' | 'status'>>;

function issue(teamId: number, repoId: number, repoName: string, seed: Seed): MockIssue {
  return {
    id: teamId * 1000 + seed.number,
    teamId,
    repoId,
    repoName,
    body: `## 배경\n${seed.title}에 대한 작업이에요.\n\n## 할 일\n- [ ] 설계 확인\n- [x] 이슈 등록\n- [ ] 구현\n\n참고: [GitHub 문서](https://docs.github.com)`,
    state: seed.status === 'DONE' ? 'CLOSED' : 'OPEN',
    assignees: [],
    labels: [],
    startDate: null,
    dueDate: null,
    inProject: true,
    author: me,
    commentCount: 0,
    githubUrl: `https://github.com/example/${repoName}/issues/${seed.number}`,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
    subIssues: { total: 0, done: 0 },
    ...seed,
  };
}

/** Team 1 (Flex) has the full set; team 2 a few */
export const ISSUES: MockIssue[] = [
  issue(1, 11, 'linker-web', {
    number: 12,
    title: '로그인 시트 UI 구현',
    status: 'DONE',
    assignees: [me],
    labels: [label('feature')],
    startDate: dateOnly(-8),
    dueDate: dateOnly(-5),
  }),
  issue(1, 11, 'linker-web', {
    number: 15,
    title: '피드 카드 컴포넌트',
    status: 'IN_PROGRESS',
    assignees: [d(hayun), me],
    labels: [label('feature'), label('design')],
    startDate: dateOnly(-3),
    dueDate: dateOnly(2),
    commentCount: 4,
    subIssues: { total: 3, done: 1 },
  }),
  issue(1, 11, 'linker-web', {
    number: 18,
    title: '이슈 필터 시트 접근성 개선',
    status: 'TODO',
    assignees: [me],
    labels: [label('help wanted')],
    startDate: dateOnly(1),
    dueDate: dateOnly(5),
  }),
  issue(1, 12, 'linker-api', {
    number: 7,
    title: 'JWT 쿠키 발급 및 갱신',
    status: 'IN_PROGRESS',
    assignees: [d(doyun)],
    labels: [label('feature')],
    startDate: dateOnly(-6),
    dueDate: dateOnly(-1),
    commentCount: 2,
  }),
  issue(1, 12, 'linker-api', {
    number: 9,
    title: '웹훅 서명 검증 실패 시 500 반환',
    status: 'BLOCKED',
    assignees: [d(doyun), d(minjae)],
    labels: [label('bug')],
    startDate: dateOnly(-4),
    dueDate: dateOnly(1),
    commentCount: 6,
  }),
  issue(1, 12, 'linker-api', {
    number: 10,
    title: '신고 5회 누적 시 임시 숨김',
    status: 'TODO',
    assignees: [d(minjae)],
    labels: [label('feature')],
    startDate: dateOnly(3),
    dueDate: dateOnly(8),
  }),
  issue(1, 11, 'linker-web', {
    number: 21,
    title: '바텀 탭 아이콘 교체',
    status: 'TODO',
    assignees: [d(seoyeon)],
    labels: [label('design')],
    dueDate: dateOnly(4),
  }),
  issue(1, 11, 'linker-web', {
    number: 22,
    title: 'README 영문 번역',
    status: 'TODO',
    labels: [label('docs')],
    inProject: false,
  }),
  issue(1, 12, 'linker-api', {
    number: 11,
    title: '레이트 리밋 헤더 문서화',
    status: 'DONE',
    assignees: [d(doyun)],
    labels: [label('docs')],
    startDate: dateOnly(-9),
    dueDate: dateOnly(-7),
  }),
  issue(1, 12, 'linker-api', {
    number: 14,
    title: '배포 파이프라인 정리',
    status: 'OTHER',
    assignees: [d(jiwoo)],
    dueDate: dateOnly(10),
  }),
  issue(2, 21, 'study-notes', {
    number: 3,
    title: '이번 주 스터디 노트 정리',
    status: 'TODO',
    assignees: [me],
    dueDate: dateOnly(2),
  }),
  issue(2, 21, 'study-notes', {
    number: 4,
    title: '발표 자료 초안',
    status: 'IN_PROGRESS',
    assignees: [d(hayun)],
    startDate: dateOnly(-1),
    dueDate: dateOnly(3),
  }),
];

export function findIssue(teamId: string | number, issueId: string | number) {
  return ISSUES.find(
    (item) =>
      item.teamId === Number(teamId) &&
      (item.id === Number(issueId) || item.number === Number(issueId)),
  );
}

export const STATUS_LABELS: Record<IssueStatus, string> = {
  TODO: '작업 전',
  IN_PROGRESS: '작업 중',
  BLOCKED: '작업 중단',
  DONE: '작업 완료',
  OTHER: '기타',
};

/** Overdue = past due and not done (POL-I-4) */
export function isOverdue(item: MockIssue) {
  return item.status !== 'DONE' && item.dueDate !== null && item.dueDate < dateOnly(0);
}
