import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { safeStorage } from '@/lib/browser/safe-storage';
import { renderWithProviders } from '@/test/render-with-providers';

import { issueDraftKey } from '../../_lib/issue-draft';
import { IssueContentStep } from './IssueContentStep';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const formTemplate = {
  key: 'form:request',
  source: 'REPO',
  name: '요청',
  description: '',
  kind: 'FORM',
  defaultTitle: '[요청] ',
  defaultLabels: ['help wanted'],
  defaultAssignees: ['me'],
  fallback: false,
  fields: [
    { id: 'summary', type: 'input', label: '요약', required: true },
    { id: 'shot', type: 'upload', label: '스크린샷' },
  ],
};

type Route = { match: (url: string, init?: RequestInit) => boolean; reply: () => unknown };

function serve(...extra: Route[]) {
  const routes: Route[] = [
    ...extra,
    { match: (url) => url.includes('/issue-templates/'), reply: () => formTemplate },
    {
      match: (url) => url.endsWith('/issue-create/repos'),
      reply: () => ({
        items: [{ id: 11, name: 'linker-web', fullName: 'a/linker-web', canWrite: true }],
      }),
    },
    {
      match: (url) => url.includes('/assignee-candidates'),
      reply: () => ({
        items: [
          {
            id: 1,
            login: 'me',
            name: '한서준',
            avatarUrl: 'https://avatars.githubusercontent.com/u/1',
          },
        ],
        max: 10,
      }),
    },
    {
      match: (url) => url.includes('/label-options'),
      reply: () => ({ items: [{ name: 'help wanted', color: '008672' }] }),
    },
    {
      match: (url) => url.includes('/issue-sync-jobs/'),
      reply: () => ({
        status: 'DONE',
        steps: [{ name: '이슈 만들기', done: true }],
        issueId: 1120,
        failedStep: null,
      }),
    },
  ];
  fetchMock.mockImplementation(async (url, init) => {
    const route = routes.find((item) => item.match(url, init));
    if (!route) throw new Error(`unexpected ${url}`);
    return route.reply();
  });
}

const created = {
  match: (url: string, init?: RequestInit) => url.endsWith('/issues') && init?.method === 'POST',
  reply: () => ({ jobId: '7', issueId: 1120 }),
};

const renderStep = (onCreated = vi.fn()) =>
  renderWithProviders(
    <IssueContentStep
      teamId="1"
      repoId={11}
      templateKey="form:request"
      initial={null}
      onChangeTemplate={vi.fn()}
      onCreated={onCreated}
    />,
    { viewer: { role: 'developer', login: 'me' } },
  );

beforeEach(() => {
  fetchMock.mockReset();
  safeStorage.remove(issueDraftKey('1'));
});

it('starts from the form template defaults, accessibly', async () => {
  serve();
  const { container } = renderStep();
  expect(await screen.findByLabelText(/제목/)).toHaveValue('[요청] ');
  expect(screen.getByText('첨부는 GitHub에서 할 수 있어요.', { exact: false })).toBeVisible();
  expect(await screen.findByText('한서준')).toBeVisible();
  expect(screen.getByText('help wanted')).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});

it('sends the GitHub-format body with the template defaults, then leaves for the detail', async () => {
  serve(created);
  const onCreated = vi.fn();
  renderStep(onCreated);
  await userEvent.type(await screen.findByLabelText(/요약/), '다크 모드');
  await screen.findByText('한서준');
  await userEvent.click(screen.getByRole('button', { name: '이슈 만들기' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('/teams/1/issues/1120'), {
    timeout: 3000,
  });
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({
    repoId: 11,
    templateKey: 'form:request',
    title: '[요청]',
    body: '### 요약\n\n다크 모드',
    assigneeIds: [1],
    labels: ['help wanted'],
    startDate: null,
    dueDate: null,
    status: 'TODO',
  });
  expect(safeStorage.get(issueDraftKey('1'))).toBeNull();
});

it('keeps the content on the device and offers "다시 보내기" when GitHub fails (POL-I-1)', async () => {
  let fail = true;
  serve({
    match: (url, init) => url.endsWith('/issues') && init?.method === 'POST',
    reply: () => {
      if (fail) throw new ApiError(503, { code: 'GITHUB_UNAVAILABLE', message: 'GitHub 오류' });
      return { jobId: '7', issueId: 1120 };
    },
  });
  const onCreated = vi.fn();
  renderStep(onCreated);
  await userEvent.type(await screen.findByLabelText(/요약/), '다크 모드');
  await userEvent.click(screen.getByRole('button', { name: '이슈 만들기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'GitHub에 연결하지 못했어요. 작성한 내용은 저장해 두었어요.',
  );
  expect(
    safeStorage.get<{ value: { answers: { summary: string } } }>(issueDraftKey('1'))?.value.answers
      .summary,
  ).toBe('다크 모드');
  expect(onCreated).not.toHaveBeenCalled();
  fail = false;
  await userEvent.click(screen.getByRole('button', { name: '다시 보내기' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalled(), { timeout: 3000 });
});

it('stops at the first missing required item and focuses it', async () => {
  serve();
  renderStep();
  const title = await screen.findByLabelText(/제목/);
  await userEvent.clear(title);
  await userEvent.click(screen.getByRole('button', { name: '이슈 만들기' }));
  expect(await screen.findByText('제목을 입력해 주세요.')).toBeVisible();
  expect(screen.getByText('필수 항목이에요.')).toBeVisible();
  expect(title).toHaveFocus();
  expect(title).toHaveAttribute('aria-invalid', 'true');
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
});
