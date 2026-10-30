import { fail, get, newId, post, type MockRoute } from '../core/define';
import { ISSUES, type MockIssue } from '../fixtures/issues';
import { findTeam } from '../fixtures/teams';
import { brief, ME } from '../fixtures/users';

/** 13 Create issue: `IssueCreateController`. Creation is 202 + a job that finishes after a few polls. */

const templates = [
  { key: 'repo:bug', source: 'REPO', name: '버그 제보' },
  { key: 'default:feature', source: 'DEFAULT', name: '기능 제안' },
  { key: 'default:task', source: 'DEFAULT', name: '작업' },
  { key: 'form:request', source: 'REPO', name: '요청 (이슈 폼)' },
];

const bodies: Record<string, string> = {
  'repo:bug': '## 현상\n\n## 재현 방법\n1. \n\n## 기대 결과\n',
  'default:feature': '## 배경\n\n## 제안\n\n## 완료 조건\n- [ ] \n',
  'default:task': '## 할 일\n- [ ] \n',
};

// Issue forms (YAML) arrive as a field list (POL-I-1)
const formFields = [
  {
    id: 'summary',
    type: 'input',
    label: '요약',
    required: true,
    placeholder: '한 줄로 적어 주세요',
  },
  { id: 'detail', type: 'textarea', label: '자세한 내용', required: false },
  {
    id: 'kind',
    type: 'dropdown',
    label: '종류',
    required: true,
    options: ['기능', '버그', '문서'],
  },
  {
    id: 'checks',
    type: 'checkboxes',
    label: '확인 사항',
    options: ['중복 이슈를 확인했어요', '재현 가능해요'],
  },
];

const jobs = new Map<string, { polls: number; issueId: number }>();

export const routes: MockRoute[] = [
  get('/api/v1/user/teams/:teamId/issue-templates', () => ({ items: templates })),
  get('/api/v1/user/teams/:teamId/issue-templates/:templateKey', ({ params }) => {
    const template = templates.find((t) => t.key === params.templateKey);
    if (!template) fail(404, 'NOT_FOUND', '템플릿을 찾지 못했어요');
    return params.templateKey === 'form:request'
      ? {
          ...template,
          kind: 'FORM',
          fields: formFields,
          defaultLabels: ['help wanted'],
          defaultAssignees: [],
        }
      : {
          ...template,
          kind: 'MARKDOWN',
          body: bodies[params.templateKey!] ?? '',
          defaultLabels: [],
          defaultAssignees: [],
        };
  }),
  post('/api/v1/user/teams/:teamId/issues', ({ params, body }) => {
    const team = findTeam(params.teamId!);
    if (!team || team.id === 2) {
      fail(
        403,
        'GITHUB_PERMISSION',
        '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.',
      );
    }
    const repo = team.repos.find((r) => r.id === Number(body.repoId)) ?? team.repos[0]!;
    const number = 100 + ISSUES.length;
    const now = new Date().toISOString();
    const issue: MockIssue = {
      id: team.id * 1000 + number,
      teamId: team.id,
      number,
      repoId: repo.id,
      repoName: repo.name,
      title: String(body.title ?? '제목 없음'),
      body: String(body.body ?? ''),
      status: 'TODO',
      state: 'OPEN',
      assignees: [],
      labels: [],
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
    jobs.set(jobId, { polls: 0, issueId: issue.id });
    return { jobId, issueId: issue.id };
  }),
  // create issue → add to project → start date → due date → status (POL-I sync)
  get('/api/v1/user/teams/:teamId/issue-sync-jobs/:jobId', ({ params }) => {
    const job = jobs.get(params.jobId!);
    if (!job) fail(404, 'NOT_FOUND', '작업을 찾지 못했어요');
    job.polls += 1;
    const steps = ['이슈 만들기', '프로젝트에 추가', '시작일', '마감일', '상태'];
    const done = Math.min(job.polls, steps.length);
    return {
      status: done === steps.length ? 'DONE' : 'RUNNING',
      steps: steps.map((name, index) => ({ name, done: index < done })),
      issueId: job.issueId,
      failedStep: null as string | null,
    };
  }),
];
