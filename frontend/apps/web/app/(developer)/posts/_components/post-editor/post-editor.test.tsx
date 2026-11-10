import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { EditorRepo, PostEditForm, RepoSummary } from '../../_lib/editor-queries';
import { emptyPostForm } from '../../_lib/schema';
import { PostContentForm } from './post-content-form/PostContentForm';
import { PostEdit } from './post-edit/PostEdit';
import { RepoStep } from './repo-step/RepoStep';

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
  expect(await screen.findByText('저장소를 선택해 주세요')).toBeVisible();
  expect(screen.getByPlaceholderText('저장소 검색하기')).toBeVisible();
  expect(await screen.findByText('포크')).toBeVisible();
  expect(screen.getByRole('radio', { name: /linker-web/ })).toBeDisabled();
  expect(screen.getByText('(이미 피드에 올린 레포)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('radio', { name: /react-fork/ }));
  expect(onSelect).toHaveBeenCalledWith(42);
  expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: '다음' }));
  expect(onNext).toHaveBeenCalledWith(42);
});

const cover = { fileId: 'a', url: '/mock/cover-1.svg' };

it('asks for at least one photo before publishing (POL-P-2)', async () => {
  const user = userEvent.setup();
  renderWithProviders(
    <PostContentForm
      target={{ mode: 'create', repoId: 12 }}
      repo={summary}
      photoLimit={summary.photoLimit}
      initial={{ values: { ...emptyPostForm(), intro: '팀 협업 웹앱' }, photos: [] }}
      draftKey="draft:post:no-photo"
      onSaved={vi.fn()}
    />,
    developer,
  );

  await user.click(screen.getByRole('button', { name: '게시하기' }));

  expect(await screen.findByText('사진을 1장 이상 올려 주세요.')).toBeVisible();
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/user/posts')).toBe(false);
});

it('validates the content step and publishes the post body', async () => {
  const user = userEvent.setup();
  const onSaved = vi.fn();
  const values = { ...emptyPostForm(), periodStart: '2026-09' };
  const { container } = renderWithProviders(
    <PostContentForm
      target={{ mode: 'create', repoId: 12 }}
      repo={summary}
      photoLimit={summary.photoLimit}
      initial={{ values, photos: [cover] }}
      draftKey="draft:post:test"
      onSaved={onSaved}
    />,
    developer,
  );
  // Figma 274:329 — empty body shows the placeholder
  expect(screen.getByLabelText(/프로젝트 본문/)).toHaveValue('');
  expect(screen.getByPlaceholderText('프로젝트에 관해 간단하게 글을 작성해 주세요')).toBeVisible();
  expect(screen.getByText('선택한 저장소')).toBeVisible();
  expect(screen.getByText('프로젝트 소개')).toBeVisible();
  expect(screen.getByRole('button', { name: '시작일 2026.09' })).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await user.type(screen.getByLabelText('데모 링크 1'), 'http://demo.example');
  await user.click(screen.getByRole('button', { name: '게시하기' }));
  expect(await screen.findByText('한 줄 소개를 입력해 주세요.')).toBeVisible();
  expect(screen.getByText('https://로 시작하는 주소만 넣을 수 있어요.')).toBeVisible();

  await user.type(screen.getByLabelText(/프로젝트 소개/), '팀 협업 웹앱');
  await user.type(screen.getByLabelText(/프로젝트 본문/), 'Spring Boot API');
  await user.clear(screen.getByLabelText('데모 링크 1'));
  await user.type(screen.getByLabelText('데모 링크 1'), 'https://demo.example');
  await user.type(screen.getByLabelText(/팀 규모/), '4');
  await user.click(screen.getByRole('button', { name: '게시하기' }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(77));
  const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/v1/user/posts')!;
  expect(JSON.parse(String(init?.body))).toEqual({
    repoId: 12,
    intro: '팀 협업 웹앱',
    body: 'Spring Boot API',
    photos: [cover],
    myRole: null,
    demoLinks: ['https://demo.example'],
    period: { start: '2026-09', end: null },
    teamSize: 4,
    tags: [],
  });
});

it('drops emoji from the intro and body as they are typed or pasted (POL-P-2)', async () => {
  const user = userEvent.setup();
  renderWithProviders(
    <PostContentForm
      target={{ mode: 'create', repoId: 12 }}
      repo={summary}
      photoLimit={summary.photoLimit}
      initial={{ values: emptyPostForm(), photos: [] }}
      draftKey="draft:post:emoji"
      onSaved={vi.fn()}
    />,
    developer,
  );

  await user.type(screen.getByLabelText(/프로젝트 소개/), '배포 🚀완료');
  expect(screen.getByLabelText(/프로젝트 소개/)).toHaveValue('배포 완료');

  await user.click(screen.getByLabelText(/프로젝트 본문/));
  await user.paste('감사합니다🙏 다음에도');
  expect(screen.getByLabelText(/프로젝트 본문/)).toHaveValue('감사합니다 다음에도');
  expect(screen.queryByText('이모지는 입력할 수 없어요.')).not.toBeInTheDocument();
});

it('opens the start-date wheel sheet with year, month and day', async () => {
  const user = userEvent.setup();
  renderWithProviders(
    <PostContentForm
      target={{ mode: 'create', repoId: 12 }}
      repo={summary}
      photoLimit={summary.photoLimit}
      initial={{ values: emptyPostForm(), photos: [] }}
      draftKey="draft:post:period"
      onSaved={vi.fn()}
    />,
    developer,
  );

  await user.click(screen.getByRole('button', { name: '시작일' }));
  const sheet = await screen.findByRole('dialog', { name: '시작일' });
  expect(within(sheet).getByRole('listbox', { name: '연도' })).toBeVisible();
  expect(within(sheet).getByRole('listbox', { name: '월' })).toBeVisible();
  expect(within(sheet).getByRole('listbox', { name: '일' })).toBeVisible();
  expect(within(sheet).getByRole('button', { name: '저장' })).toBeVisible();
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
  renderWithProviders(<PostEdit postId="5" />, developer);

  expect(await screen.findByDisplayValue('기존 소개')).toBeVisible();
  expect(screen.getByDisplayValue('https://linker.example')).toBeVisible();
  expect(screen.getByText('사진 추가').closest('label')).toHaveTextContent('(2/5)');
  expect(screen.getByText('대표 이미지')).toBeVisible();
  expect(screen.getByRole('button', { name: '수정 완료' })).toBeVisible();
});
