import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { EditorRepo, PostEditForm, RepoSummary } from '../../_lib/editor-queries';
import { emptyPostForm } from '../../_lib/schema';
import { PostContentForm } from './post-content-form';
import { PostEdit } from './post-edit';
import { RepoStep } from './repo-step';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
// Long forms typed key by key plus axe: well under 5s alone, but not with the whole suite in parallel
vi.setConfig({ testTimeout: 15_000 });
const developer = { viewer: { role: 'developer' as const, login: 'developer' } };

const repos: EditorRepo[] = [
  {
    repoId: 11,
    fullName: 'linker-hack/linker-web',
    language: 'TypeScript',
    stars: 28,
    isFork: false,
    teamId: 1,
    alreadyPosted: true,
  },
  {
    repoId: 42,
    fullName: 'seojun-han/react-fork',
    language: 'JavaScript',
    stars: 0,
    isFork: true,
    parentFullName: 'facebook/react',
    teamId: null,
    alreadyPosted: false,
  },
];

const summary: RepoSummary = {
  repoId: 12,
  fullName: 'linker-hack/linker-api',
  description: 'Spring Boot API',
  language: 'Java',
  stars: 12,
  isFork: false,
  parentFullName: null,
  authorCommitCount: 0,
  handledIssueCount: 17,
  photoLimit: 5,
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/user/post-editor/repos')) return { items: repos };
    if (url === '/api/v1/user/posts') return { id: 77 };
    return undefined;
  });
});

it('lists repos with forks and already-posted ones disabled', async () => {
  const user = userEvent.setup();
  const onNext = vi.fn();
  const onSelect = vi.fn();
  // The real parent keeps the choice in the URL; a little state stands in for it here
  function Harness() {
    const [repoId, setRepoId] = useState<number | null>(null);
    return (
      <RepoStep
        teamId={null}
        repoId={repoId}
        onSelect={(id) => {
          onSelect(id);
          setRepoId(id);
        }}
        onNext={onNext}
      />
    );
  }
  const { container } = renderWithProviders(<Harness />, developer);
  expect(await screen.findByText('포크 · 원본 facebook/react')).toBeVisible();
  expect(screen.getByRole('radio', { name: /linker-web/ })).toBeDisabled();
  expect(screen.getByText('이미 올린 레포')).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('button', { name: '다음' }));
  expect(await screen.findByText('소개할 레포를 골라 주세요.')).toBeVisible();
  await user.click(screen.getByRole('radio', { name: /react-fork/ }));
  expect(onSelect).toHaveBeenCalledWith(42);
  await user.click(screen.getByRole('button', { name: '다음' }));
  expect(onNext).toHaveBeenCalledWith(42);
});

it('validates the content step and publishes the post body', async () => {
  const user = userEvent.setup();
  const onSaved = vi.fn();
  const { container } = renderWithProviders(
    <PostContentForm
      target={{ mode: 'create', repoId: 12 }}
      repo={summary}
      photoLimit={summary.photoLimit}
      initial={{ values: emptyPostForm(summary.description ?? ''), photos: [] }}
      draftKey="draft:post:test"
      onSaved={onSaved}
    />,
    developer,
  );
  // Body starts from the repo description; 0 commits shows the email guidance
  expect(screen.getByLabelText(/^본문/)).toHaveValue('Spring Boot API');
  expect(
    screen.getByText('커밋에 쓴 이메일이 GitHub 계정에 등록돼 있어야 숫자에 잡혀요.'),
  ).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('button', { name: '링크 추가' }));
  await user.type(screen.getByLabelText('데모 링크 1'), 'http://demo.example');
  await user.click(screen.getByRole('button', { name: '게시하기' }));
  expect(await screen.findByText('한 줄 소개를 입력해 주세요.')).toBeVisible();
  expect(screen.getByText('https://로 시작하는 주소만 넣을 수 있어요.')).toBeVisible();

  await user.type(screen.getByLabelText(/^한 줄 소개/), '팀 협업 웹앱');
  await user.clear(screen.getByLabelText('데모 링크 1'));
  await user.type(screen.getByLabelText('데모 링크 1'), 'https://demo.example');
  await user.type(screen.getByLabelText('시작한 달'), '2026-09');
  await user.type(screen.getByLabelText(/^팀 규모/), '4');
  await user.click(screen.getByRole('button', { name: '게시하기' }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(77));
  const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/v1/user/posts')!;
  expect(JSON.parse(String(init?.body))).toEqual({
    repoId: 12,
    intro: '팀 협업 웹앱',
    body: 'Spring Boot API',
    photos: [],
    myRole: null,
    demoLinks: ['https://demo.example'],
    period: { start: '2026-09', end: null },
    teamSize: 4,
    tags: [],
  });
});

it('fills the edit screen with the saved post and its photos', async () => {
  const editForm: PostEditForm = {
    id: 5,
    intro: '기존 소개',
    body: '기존 본문',
    photos: [
      { fileId: 'a', url: '/mock/cover-1.svg' },
      { fileId: 'b', url: '/mock/cover-2.svg' },
    ],
    myRole: '프론트엔드',
    demoLinks: ['https://linker.example'],
    period: { start: '2026-08', end: '2026-10' },
    teamSize: 5,
    tags: ['React'],
    repo: { ...summary, authorCommitCount: 84 },
    photoLimit: 5,
  };
  fetchMock.mockImplementation(async (url) => (url.endsWith('/edit-form') ? editForm : undefined));
  const user = userEvent.setup();
  renderWithProviders(<PostEdit postId="5" />, developer);

  expect(await screen.findByDisplayValue('기존 소개')).toBeVisible();
  expect(screen.getByDisplayValue('https://linker.example')).toBeVisible();
  expect(screen.getByText('2/5')).toBeVisible();
  expect(screen.getByText('대표')).toBeVisible();
  expect(screen.queryByText(/이메일이 GitHub 계정에/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '사진 1 앞으로' })).toBeDisabled();

  // Moving photo 2 forward makes it the cover
  const sources = () =>
    screen.getAllByRole('img', { name: /선택한 사진/ }).map((img) => img.getAttribute('src'));
  const before = sources();
  await user.click(screen.getByRole('button', { name: '사진 2 앞으로' }));
  expect(sources()).toEqual([before[1], before[0]]);
  expect(screen.getByRole('button', { name: '수정 완료' })).toBeVisible();
});
