import { fail, get, newId, post, type MockRoute } from '../core/define';
import { ISSUES, LABELS, type IssueStatus, type MockIssue } from '../fixtures/issues';
import { findTeam, TEAM_MEMBERS, withMockJobRole } from '../fixtures/teams';
import { brief, ME } from '../fixtures/users';

/**
 * 13 Create issue: repos from 11 `issue-filters`; templates list carries assignees/labels;
 * create is 202 `IssueCreateResponse` + poll `issue-sync-jobs/{jobId}`.
 */

type Source = 'REPO' | 'ORG' | 'DEFAULT';

const templates: {
  key: string;
  source: Source;
  name: string;
  description: string;
  format: 'MARKDOWN' | 'FORM';
}[] = [
  {
    key: 'repo:bug',
    source: 'REPO',
    name: '버그 제보',
    description: '고쳐야 할 문제를 알려 주세요',
    format: 'MARKDOWN',
  },
  {
    key: 'form:request',
    source: 'REPO',
    name: '요청 (이슈 폼)',
    description: '입력란을 채우면 본문이 만들어져요',
    format: 'FORM',
  },
  {
    key: 'repo:broken',
    source: 'REPO',
    name: '배포 체크리스트',
    description: '레포에 있는 템플릿',
    format: 'MARKDOWN',
  },
  {
    key: 'default:bug',
    source: 'DEFAULT',
    name: '버그',
    description: '고쳐야 할 문제',
    format: 'MARKDOWN',
  },
  {
    key: 'default:feature',
    source: 'DEFAULT',
    name: '기능',
    description: '새로 만들 기능',
    format: 'MARKDOWN',
  },
  {
    key: 'default:task',
    source: 'DEFAULT',
    name: '작업',
    description: '해야 할 일',
    format: 'MARKDOWN',
  },
];

const bodies: Record<string, string> = {
  'repo:bug': '## 현상\n\n## 재현 방법\n1. \n\n## 기대 결과\n',
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

type JobState = {
  polls: number;
  issueId: number;
  failed: boolean;
  teamId: number;
};

const jobs = new Map<number, JobState>();
/** Titles that fail once on create (browser mock state; for e2e "다시 보내기"). */
const createFailTries = new Map<string, number>();

function templateList(teamId: number) {
  const members = TEAM_MEMBERS[teamId] ?? [];
  return {
    templates: templates.map(({ key, source, name, description, format }) => ({
      key,
      source,
      name,
      description,
      format,
    })),
    assigneeCandidates: members
      .filter((m) => m.inGithubOrg)
      .map((m) => withMockJobRole(m.user)),
    labelOptions: LABELS,
    maxAssignees: 10,
  };
}

export const routes: MockRoute[] = [
  get('/api/v1/user/teams/:teamId/issue-templates', ({ params }) => {
    const team = teamOr404(params.teamId);
    return templateList(team.id);
  }),
  get('/api/v1/user/teams/:teamId/issue-templates/:templateKey', ({ params }) => {
    const template = templates.find((t) => t.key === params.templateKey);
    if (!template) fail(404, 'NOT_FOUND', '템플릿을 찾지 못했어요');
    if (params.templateKey === 'repo:broken') {
      const fallback = templates.find((t) => t.key === 'default:task')!;
      return {
        key: fallback.key,
        name: fallback.name,
        description: fallback.description,
        format: 'MARKDOWN',
        source: fallback.source,
        title: '',
        body: bodies['default:task'],
        fields: [],
        labels: [],
        assignees: [],
        projects: [],
        issueType: null,
        fallback: true,
      };
    }
    if (params.templateKey === 'form:request') {
      return {
        key: template.key,
        name: template.name,
        description: template.description,
        format: 'FORM',
        source: template.source,
        title: '[요청] ',
        body: '',
        fields: [
          {
            id: 'summary',
            type: 'input',
            label: '요약',
            description: '',
            value: '',
            options: [],
            requiredOptions: [],
            required: true,
            multiple: false,
            render: '',
            defaultValues: [],
            placeholder: '',
          },
          {
            id: 'detail',
            type: 'textarea',
            label: '자세한 내용',
            description: '',
            value: '',
            options: [],
            requiredOptions: [],
            required: false,
            multiple: false,
            render: '',
            defaultValues: [],
            placeholder: '',
          },
          {
            id: 'shot',
            type: 'upload',
            label: '스크린샷',
            description: '',
            value: '',
            options: [],
            requiredOptions: [],
            required: false,
            multiple: false,
            render: '',
            defaultValues: [],
            placeholder: '',
          },
        ],
        labels: ['help wanted'],
        assignees: [ME.login],
        projects: [],
        issueType: null,
        fallback: false,
      };
    }
    return {
      key: template.key,
      name: template.name,
      description: template.description,
      format: 'MARKDOWN',
      source: template.source,
      title: '',
      body: bodies[params.templateKey] ?? '',
      fields: [],
      labels: params.templateKey === 'repo:bug' ? ['bug'] : [],
      assignees: [],
      projects: [],
      issueType: null,
      fallback: false,
    };
  }),
  post('/api/v1/user/teams/:teamId/issues', ({ params, body }) => {
    const team = teamOr404(params.teamId);
    if (!canWrite(team.id)) {
      fail(
        403,
        'FORBIDDEN',
        '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.',
      );
    }
    if (!body.requestId) fail(400, 'VALIDATION_ERROR', 'requestId가 필요해요');
    const title = String(body.title ?? '').trim();
    if (title === '실패 후 재시도') {
      const tries = createFailTries.get(title) ?? 0;
      createFailTries.set(title, tries + 1);
      if (tries < 1) fail(503, 'GITHUB_UNAVAILABLE', 'GitHub 오류');
    }
    const repo = team.repos.find((r) => r.id === Number(body.repoId)) ?? team.repos[0]!;
    const members = TEAM_MEMBERS[team.id] ?? [];
    const assigneeIds = (body.assigneeIds as number[] | undefined) ?? [];
    const labelNames = (body.labels as string[] | undefined) ?? [];
    const answers = (body.answers as Record<string, string[]> | undefined) ?? {};
    const number = 100 + ISSUES.length;
    const now = new Date().toISOString();
    let issueBody = String(body.body ?? '');
    if (body.templateKey === 'form:request') {
      const summary = answers.summary?.[0]?.trim() || '_No response_';
      const detail = answers.detail?.[0]?.trim() || '_No response_';
      issueBody = `### 요약\n\n${summary}\n\n### 자세한 내용\n\n${detail}`;
    }
    const issue: MockIssue = {
      id: team.id * 1000 + number,
      teamId: team.id,
      number,
      repoId: repo.id,
      repoName: repo.name,
      title: title || '제목 없음',
      body: issueBody,
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
    const jobId = newId();
    const failed = title.includes('일정 실패');
    jobs.set(jobId, {
      polls: 0,
      issueId: issue.id,
      failed,
      teamId: team.id,
    });
    return {
      jobId,
      status: 'PENDING',
      step: 'CREATE',
      issueId: null,
      detailPath: null,
      errorCode: null,
      retryScheduled: false,
      retryAfterSeconds: null,
    };
  }),
  get('/api/v1/user/teams/:teamId/issue-sync-jobs/:jobId', ({ params }) => {
    const jobId = Number(params.jobId);
    const job = jobs.get(jobId);
    if (!job) fail(404, 'NOT_FOUND', '작업을 찾지 못했어요');
    job.polls += 1;
    if (job.failed && job.polls >= 2) {
      return {
        jobId,
        status: 'FAILED',
        step: 'SCHEDULE',
        issueId: job.issueId,
        detailPath: `/teams/${job.teamId}/issues/${job.issueId}`,
        errorCode: 'GITHUB_UNAVAILABLE',
        retryScheduled: true,
        retryAfterSeconds: 60,
      };
    }
    if (job.polls >= 2) {
      return {
        jobId,
        status: 'DONE',
        step: 'DONE',
        issueId: job.issueId,
        detailPath: `/teams/${job.teamId}/issues/${job.issueId}`,
        errorCode: null,
        retryScheduled: false,
        retryAfterSeconds: null,
      };
    }
    return {
      jobId,
      status: 'RUNNING',
      step: 'CREATE',
      issueId: null,
      detailPath: null,
      errorCode: null,
      retryScheduled: false,
      retryAfterSeconds: null,
    };
  }),
];
