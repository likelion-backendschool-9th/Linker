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
  format: 'FORM',
  title: '[요청] ',
  body: '',
  labels: ['help wanted'],
  assignees: ['me'],
  fallback: false,
  fields: [
    {
      id: 'summary',
      type: 'input',
      label: '요약',
      required: true,
      options: [],
      requiredOptions: [],
    },
    { id: 'shot', type: 'upload', label: '스크린샷', options: [], requiredOptions: [] },
  ],
};

const templateList = {
  templates: [{ key: 'form:request', source: 'REPO', name: '요청', description: '', format: 'FORM' }],
  assigneeCandidates: [
    {
      id: 1,
      login: 'me',
      name: '한서준',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
    },
  ],
  labelOptions: [{ name: 'help wanted', color: '008672' }],
  maxAssignees: 10,
};

type Route = { match: (url: string, init?: RequestInit) => boolean; reply: () => unknown };

function serve(...extra: Route[]) {
  const routes: Route[] = [
    ...extra,
    {
      match: (url) => /\/issue-templates\/[^?]+/.test(url),
      reply: () => formTemplate,
    },
    {
      match: (url) => url.includes('/issue-templates?'),
      reply: () => templateList,
    },
    {
      match: (url) => url.includes('/issue-sync-jobs/'),
      reply: () => ({
        jobId: 7,
        status: 'DONE',
        step: 'DONE',
        issueId: 1120,
        detailPath: '/teams/1/issues/1120',
        errorCode: null,
        retryScheduled: false,
        retryAfterSeconds: null,
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
  reply: () => ({
    jobId: 7,
    status: 'DONE',
    step: 'DONE',
    issueId: 1120,
    detailPath: '/teams/1/issues/1120',
    errorCode: null,
    retryScheduled: false,
    retryAfterSeconds: null,
  }),
};

const submitName = 'GitHub에 이슈 작성하기';

const renderStep = (onCreated = vi.fn()) =>
  renderWithProviders(
    <IssueContentStep
      teamId="1"
      repoId={11}
      templateKey="form:request"
      repoLabel="linker-web"
      templateLabel="요청"
      onOpenRepo={vi.fn()}
      onOpenTemplate={vi.fn()}
      initial={null}
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
  expect(await screen.findByLabelText(/이슈 제목/)).toHaveValue('[요청] ');
  expect(screen.getByText('첨부는 GitHub에서 할 수 있어요.', { exact: false })).toBeVisible();
  expect(await screen.findByText('한서준')).toBeVisible();
  expect(screen.getByText('help wanted')).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});

it('sends answers (not a rendered body) with requestId, then leaves for the detail', async () => {
  serve(created);
  const onCreated = vi.fn();
  renderStep(onCreated);
  await userEvent.type(await screen.findByLabelText(/요약/), '다크 모드');
  await screen.findByText('한서준');
  await userEvent.click(screen.getByRole('button', { name: submitName }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('/teams/1/issues/1120'), {
    timeout: 3000,
  });
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
  const body = JSON.parse(String(post?.[1]?.body)) as Record<string, unknown>;
  expect(body).toMatchObject({
    repoId: 11,
    templateKey: 'form:request',
    title: '[요청]',
    answers: { summary: ['다크 모드'] },
    assigneeIds: [1],
    labels: ['help wanted'],
    status: 'TODO',
  });
  expect(body).not.toHaveProperty('body');
  expect(typeof body.requestId).toBe('string');
  expect(safeStorage.get(issueDraftKey('1'))).toBeNull();
});

it('keeps the content on the device and offers "다시 보내기" when GitHub fails (POL-I-1)', async () => {
  let fail = true;
  serve({
    match: (url, init) => url.endsWith('/issues') && init?.method === 'POST',
    reply: () => {
      if (fail) throw new ApiError(503, { code: 'GITHUB_UNAVAILABLE', message: 'GitHub 오류' });
      return {
        jobId: 7,
        status: 'DONE',
        step: 'DONE',
        issueId: 1120,
        detailPath: '/teams/1/issues/1120',
        errorCode: null,
        retryScheduled: false,
        retryAfterSeconds: null,
      };
    },
  });
  const onCreated = vi.fn();
  renderStep(onCreated);
  await userEvent.type(await screen.findByLabelText(/요약/), '다크 모드');
  await userEvent.click(screen.getByRole('button', { name: submitName }));
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

it('blocks the CTA when the title is empty', async () => {
  serve();
  renderStep();
  const title = await screen.findByLabelText(/이슈 제목/);
  await userEvent.clear(title);
  const submit = screen.getByRole('button', { name: submitName });
  expect(submit).toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(submit);
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
});

it('toggles markdown preview in the same body field (Figma 200:806)', async () => {
  serve({
    match: (url) => /\/issue-templates\/[^?]+/.test(url),
    reply: () => ({
      key: 'repo:bug',
      source: 'REPO',
      name: '버그 제보',
      description: '',
      format: 'MARKDOWN',
      title: '',
      body: '## 현상\n\n- 항목 **굵게**\n\n`code`',
      labels: [],
      assignees: [],
      fallback: false,
      fields: [],
    }),
  });
  renderWithProviders(
    <IssueContentStep
      teamId="1"
      repoId={11}
      templateKey="repo:bug"
      repoLabel="linker-web"
      templateLabel="버그 제보"
      onOpenRepo={vi.fn()}
      onOpenTemplate={vi.fn()}
      initial={null}
      onCreated={vi.fn()}
    />,
    { viewer: { role: 'developer', login: 'me' } },
  );
  expect(await screen.findByRole('textbox', { name: /이슈 본문/ })).toHaveValue(
    '## 현상\n\n- 항목 **굵게**\n\n`code`',
  );
  await userEvent.click(screen.getByRole('button', { name: '미리보기' }));
  const preview = screen.getByTestId('issue-body-preview');
  expect(preview.querySelector('h2')).toHaveTextContent('현상');
  expect(preview.querySelector('li')).toHaveTextContent('항목 굵게');
  expect(preview.querySelector('strong')).toHaveTextContent('굵게');
  expect(preview.querySelector('code')).toHaveTextContent('code');
  expect(screen.queryByRole('textbox', { name: /이슈 본문/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '마크다운 입력' }));
  expect(screen.getByRole('textbox', { name: /이슈 본문/ })).toHaveValue(
    '## 현상\n\n- 항목 **굵게**\n\n`code`',
  );
});

it('stops at the first missing required form item and focuses it', async () => {
  serve();
  renderStep();
  await screen.findByLabelText(/이슈 제목/);
  await userEvent.click(screen.getByRole('button', { name: submitName }));
  expect(await screen.findByText('필수 항목이에요.')).toBeVisible();
  expect(screen.getByLabelText(/요약/)).toHaveFocus();
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
});
