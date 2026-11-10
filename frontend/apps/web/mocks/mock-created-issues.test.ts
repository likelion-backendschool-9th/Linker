import { brief, ME } from './fixtures/users';
import {
  findIssue,
  ISSUES,
  mergeCreatedIssues,
  type MockIssue,
} from './fixtures/issues';

/** Cookie-bridge merge: server RSC rebuilds created rows the way syncCreatedIssues does. */
it('mergeCreatedIssues restores a created issue for findIssue and clears it when extras are empty', () => {
  const created: MockIssue = {
    id: 1_999_001,
    teamId: 1,
    number: 999,
    repoId: 11,
    repoName: 'linker-web',
    title: '목업 생성 이슈',
    body: '본문',
    status: 'TODO',
    state: 'OPEN',
    assignees: [],
    labels: [],
    startDate: null,
    dueDate: null,
    inProject: true,
    author: brief(ME),
    commentCount: 0,
    githubUrl: 'https://github.com/example/linker-web/issues/999',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subIssues: { total: 0, done: 0 },
  };

  mergeCreatedIssues([created]);
  expect(findIssue(1, created.id)?.title).toBe('목업 생성 이슈');
  expect(ISSUES.some((item) => item.id === created.id)).toBe(true);

  mergeCreatedIssues([]);
  expect(findIssue(1, created.id)).toBeUndefined();
});
