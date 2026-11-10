import { fail, get, newId, post, type MockRoute } from '../core/define';
import { ISSUES, LABELS, type IssueStatus, type MockIssue } from '../fixtures/issues';
import { findTeam, TEAM_MEMBERS, withMockJobRole } from '../fixtures/teams';
import { brief, ME } from '../fixtures/users';

/**
 * 13 Create issue: `IssueController`. Creation is 202 + a job that finishes after a few polls.
 * The repo-scoped `issue-create/repos`, `repos/:repoId/assignee-candidates` and `repos/:repoId/label-options`
 * are a proposal beyond WBS 13: 12's options need an issue id, and GitHub takes assignees and labels per repo.
 */

type Source = 'REPO' | 'ORG' | 'DEFAULT';

// Repo templates on top, the 3 defaults below (POL-I-1). `repo:broken` fails to parse → default template.
const templates: { key: string; source: Source; name: string; description: string }[] = [
  {
    key: 'repo:bug',
    source: 'REPO',
    name: '버그 제보',
    description: '고쳐야 할 문제를 알려 주세요',
  },
  {
    key: 'form:request',
    source: 'REPO',
    name: '요청 (이슈 폼)',
    description: '입력란을 채우면 본문이 만들어져요',
  },
  {
    key: 'repo:broken',
    source: 'REPO',
    name: '배포 체크리스트',
    description: '레포에 있는 템플릿',
  },
  { key: 'default:bug', source: 'DEFAULT', name: '버그', description: '고쳐야 할 문제' },
  { key: 'default:feature', source: 'DEFAULT', name: '기능', description: '새로 만들 기능' },
  { key: 'default:task', source: 'DEFAULT', name: '작업', description: '해야 할 일' },
];

const bodies: Record<string, string> = {
  'repo:bug': '## 현상\n\n## 재현 방법\n1. \n\n## 기대 결과\n',
  // QA: request template uses the same markdown UI as bug/feature (FORM UI kept for real YAML)
  'form:request': '## 요약\n\n## 자세한 내용\n\n## 확인 사항\n- [ ] \n',
  'default:bug': '## 현상\n\n## 재현 방법\n\n## 기대 결과\n',
  'default:feature': '## 배경\n\n## 제안\n\n## 완료 조건\n- [ ] \n',
  'default:task': '## 할 일\n- [ ] \n',
};

function teamOr404(teamId: string) {
  const team = findTeam(teamId);
  if (!team) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  return team;
}

/** Team 2 is read-only for the mock user, like 11 and 12 */
const canWrite = (teamId: number) => teamId !== 2;

const jobs = new Map<string, { polls: number; issueId: number; failedStep: string | null }>();
/** Titles that fail once on create (browser mock state; for e2e "다시 보내기"). */
const createFailTries = new Map<string, number>();

export const routes: MockRoute[] = [
  // Linked repos with my write permission (07 TODO 13 step 1)
  get('/api/v1/user/teams/:teamId/issue-create/repos', ({ params }) => {
    const team = teamOr404(params.teamId);
    return {
      items: team.repos.map(({ id, name, fullName }) => ({
        id,
        name,
        fullName,
        canWrite: canWrite(team.id),
      })),
    };
  }),
  // Members with access to this repo who accepted the org invite (POL-I-2)
  get('/api/v1/user/teams/:teamId/repos/:repoId/assignee-candidates', ({ params }) => ({
    items: (TEAM_MEMBERS[teamOr404(params.teamId).id] ?? [])
      .filter((m) => m.inGithubOrg)
      .map((m) => withMockJobRole(m.user)),
    max: 10,
  })),
  get('/api/v1/user/teams/:teamId/repos/:repoId/label-options', () => ({ items: LABELS })),

  get('/api/v1/user/teams/:teamId/issue-templates', () => ({ items: templates })),
  get('/api/v1/user/teams/:teamId/issue-templates/:templateKey', ({ params }) => {
    const template = templates.find((t) => t.key === params.templateKey);
    if (!template) fail(404, 'NOT_FOUND', '템플릿을 찾지 못했어요');
    if (params.templateKey === 'repo:broken') {
      // Parsing failed on the server → the default task template instead (POL-I-1)
      const fallback = templates.find((t) => t.key === 'default:task')!;
      return {
        ...fallback,
        kind: 'MARKDOWN',
        body: bodies['default:task'],
        defaultLabels: [],
        defaultAssignees: [],
        fallback: true,
      };
    }
    if (params.templateKey === 'form:request') {
      return {
        ...template,
        kind: 'MARKDOWN',
        body: bodies['form:request'],
        defaultTitle: '[요청] ',
        defaultLabels: ['help wanted'],
        defaultAssignees: [ME.login],
        fallback: false,
      };
    }
    return {
      ...template,
      kind: 'MARKDOWN',
      body: bodies[params.templateKey] ?? '',
      defaultLabels: params.templateKey === 'repo:bug' ? ['bug'] : [],
      defaultAssignees: [],
      fallback: false,
    };
  }),
  post('/api/v1/user/teams/:teamId/issues', ({ params, body }) => {
    const team = teamOr404(params.teamId);
    if (!canWrite(team.id)) {
      fail(
        403,
        'GITHUB_PERMISSION',
        '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.',
      );
    }
    const title = String(body.title ?? '').trim();
    // First try fails so e2e can click "다시 보내기" (page.route cannot intercept mockFetch)
    if (title === '실패 후 재시도') {
      const tries = createFailTries.get(title) ?? 0;
      createFailTries.set(title, tries + 1);
      if (tries < 1) fail(503, 'GITHUB_UNAVAILABLE', 'GitHub 오류');
    }
    const repo = team.repos.find((r) => r.id === Number(body.repoId)) ?? team.repos[0]!;
    const members = TEAM_MEMBERS[team.id] ?? [];
    const assigneeIds = (body.assigneeIds as number[] | undefined) ?? [];
    const labelNames = (body.labels as string[] | undefined) ?? [];
    const number = 100 + ISSUES.length;
    const now = new Date().toISOString();
    const issue: MockIssue = {
      id: team.id * 1000 + number,
      teamId: team.id,
      number,
      repoId: repo.id,
      repoName: repo.name,
      title: title || '제목 없음',
      body: String(body.body ?? ''),
      status: (body.status as IssueStatus | undefined) ?? 'TODO',
      state: body.status === 'DONE' ? 'CLOSED' : 'OPEN',
      assignees: members.filter((m) => assigneeIds.includes(m.user.id)).map((m) => m.user),
      labels: LABELS.filter((label) => labelNames.includes(label.name)),
      startDate: (body.startDate as string | null | undefined) ?? null,
      dueDate: (body.dueDate as string | null | undefined) ?? null,
      inProject: true,
      author: brief(ME),
      commentCount: 0,
      githubUrl: `https://github.com/${repo.fullName}/issues/${number}`,
      createdAt: now,
      updatedAt: now,
      subIssues: { total: 0, done: 0 },
    };
    ISSUES.unshift(issue);
    const jobId = String(newId());
    // A title with "일정 실패" simulates a step that keeps failing after the issue exists
    jobs.set(jobId, {
      polls: 0,
      issueId: issue.id,
      failedStep: title.includes('일정 실패') ? '마감일' : null,
    });
    return { jobId, issueId: issue.id };
  }),
  // create issue → add to project → start date → due date → status (POL-I sync)
  get('/api/v1/user/teams/:teamId/issue-sync-jobs/:jobId', ({ params }) => {
    const job = jobs.get(params.jobId);
    if (!job) fail(404, 'NOT_FOUND', '작업을 찾지 못했어요');
    job.polls += 1;
    const steps = ['이슈 만들기', '프로젝트에 추가', '시작일', '마감일', '상태'];
    const failedAt = job.failedStep ? steps.indexOf(job.failedStep) : -1;
    const done = Math.min(job.polls, failedAt >= 0 ? failedAt : steps.length);
    const failed = failedAt >= 0 && job.polls > failedAt;
    return {
      status: failed ? 'FAILED' : done === steps.length ? 'DONE' : 'RUNNING',
      steps: steps.map((name, index) => ({ name, done: index < done })),
      issueId: job.issueId,
      failedStep: failed ? job.failedStep : null,
    };
  }),
];
