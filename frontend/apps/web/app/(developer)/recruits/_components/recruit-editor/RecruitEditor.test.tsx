import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { todayKst } from '@/lib/format/time';
import { useToastStore } from '@/stores/toast-store';
import { renderWithProviders } from '@/test/render-with-providers';

import type { EditorOptions, RecruitEditForm } from '../../_lib/editor-queries';
import { RecruitEditor } from './RecruitEditor';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const replace = vi.fn();

const options: EditorOptions = {
  teams: [{ id: 1, name: 'Linker' }],
  openCount: 1,
  openLimit: 3,
  maxDeadlineDate: '2099-12-31',
};

const editForm: RecruitEditForm = {
  id: 7,
  title: '해커톤 팀원 모집',
  intro: '같이 해요.',
  format: 'ONLINE',
  region: null,
  goal: 'HACKATHON',
  duration: '2주',
  deadline: '2099-12-01',
  techTags: ['React'],
  teamId: 1,
  status: 'OPEN',
  roles: [{ id: 11, role: 'BACKEND', name: '백엔드', headcount: 2, filled: 2 }],
  lockedRoleIds: [11],
  minHeadcountByRole: { '11': 2 },
};

beforeEach(() => {
  replace.mockReset();
  // Only `replace` matters here; the rest of the stub comes from vitest.setup.ts
  vi.mocked(useRouter).mockReturnValue({ ...vi.mocked(useRouter)(), replace });
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (url === '/api/v1/user/recruit-editor/options') return options;
    if (url.endsWith('/edit-form')) return editForm;
    if (url === '/api/v1/user/recruits') return { id: 42 };
    return undefined;
  });
});

/** Messages of the toasts currently up (the Toaster itself is mounted in app providers) */
const toastMessages = () => useToastStore.getState().toasts.map((item) => item.message);

afterEach(() => useToastStore.setState({ toasts: [] }));

const developer = { viewer: { role: 'developer' as const, login: 'developer' } };

it('shows the first required error as one top toast, not under the fields', async () => {
  const user = userEvent.setup();
  const { container } = renderWithProviders(<RecruitEditor mode="create" />, developer);
  expect(await screen.findByLabelText(/^프로젝트 제목/)).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('button', { name: '모집 글 작성' }));
  await waitFor(() => expect(toastMessages()).toEqual(['제목을 입력해 주세요.']));
  expect(useToastStore.getState().toasts[0]).toMatchObject({ tone: 'alert', placement: 'top' });
  expect(screen.queryByText('제목을 입력해 주세요.')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^프로젝트 제목/)).toHaveAttribute('aria-invalid', 'true');

  // A second try replaces the toast instead of stacking another
  await user.type(screen.getByLabelText(/^프로젝트 제목/), '팀원 모집');
  await user.click(screen.getByRole('button', { name: '모집 글 작성' }));
  await waitFor(() => expect(toastMessages()).toEqual(['소개를 입력해 주세요.']));
  expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/user/recruits', expect.anything());
});

it('requires a region for offline posts and sends the form body', async () => {
  const user = userEvent.setup();
  // A non-empty initial `overlay` param makes useOverlay open the role sheet with history
  // "replace" instead of "push", so its close() actually closes it instead of calling
  // history.back() (not reliably simulated by the testing adapter) — the test needs the sheet
  // to close so later clicks on the page behind it aren't blocked by its pointer-events guard.
  renderWithProviders(<RecruitEditor mode="create" />, { ...developer, searchParams: '?overlay=share' });
  await user.type(await screen.findByLabelText(/^프로젝트 제목/), '사이드 프로젝트 팀원 모집');
  await user.type(screen.getByLabelText(/^프로젝트 소개/), '주말에 만나요.');

  // 팀 선택 sits right under 프로젝트 소개 and is required (POL-R-1, Figma 600:715)
  await user.click(screen.getByRole('button', { name: '팀 선택' }));
  await user.click(screen.getByRole('option', { name: 'Linker' }));

  // The wheel defaults to the earliest allowed date (today); "저장" alone sets it
  await user.click(screen.getByRole('button', { name: '공고 마감일' }));
  const deadlineDialog = await screen.findByRole('dialog', { name: '마감일' });
  await user.click(within(deadlineDialog).getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '마감일' })).not.toBeInTheDocument(),
  );

  await user.click(screen.getByRole('radio', { name: '오프라인' }));
  await user.click(screen.getByRole('button', { name: '모집 글 작성' }));
  // Roles come before 지역 on screen, so the toast names them first; 지역 is still marked
  await waitFor(() => expect(toastMessages()).toEqual(['모집할 역할을 하나 이상 추가해 주세요.']));
  expect(screen.getByLabelText(/^지역/)).toHaveAttribute('aria-invalid', 'true');

  await user.type(screen.getByLabelText(/^지역/), '서울 강남');

  // Roles start empty (Figma 257:2512 empty state); add one via the "역할 추가" sheet
  await user.click(screen.getByRole('button', { name: '역할 추가' }));
  const roleDialog = await screen.findByRole('dialog', { name: '모집 역할' });
  await user.click(within(roleDialog).getByRole('radio', { name: '프론트엔드' }));
  await user.click(within(roleDialog).getByRole('button', { name: '완료' }));
  // This is the second sheet opened in this test; useOverlay's close() falls back to
  // history.back() (push/pop pairing is per page, not per overlay), which the nuqs testing
  // adapter doesn't observe, so the dialog never visually unmounts here (see the "역할 추가"
  // test below for the single-sheet case, where close() takes the working branch instead).
  // The role was still added to the form — fireEvent bypasses the resulting pointer-events
  // guard on the rest of the page to keep driving the same, now-committed, form state.
  fireEvent.click(screen.getByRole('button', { name: '프론트엔드 인원 늘리기', hidden: true }));
  await waitFor(() =>
    expect(screen.getByRole('spinbutton', { name: '프론트엔드 인원', hidden: true })).toHaveValue(2),
  );
  fireEvent.click(screen.getByRole('button', { name: '모집 글 작성', hidden: true }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/recruits/42'));
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/v1/user/recruits')).toHaveLength(1);
  const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/v1/user/recruits')!;
  expect(JSON.parse(String(init?.body))).toEqual({
    title: '사이드 프로젝트 팀원 모집',
    intro: '주말에 만나요.',
    roles: [{ role: 'FRONTEND', headcount: 2 }],
    format: 'OFFLINE',
    region: '서울 강남',
    goal: null,
    duration: null,
    deadline: todayKst(),
    techTags: [],
    teamId: 1,
  });
});

it('blocks writing without a team to link (POL-R-1)', async () => {
  fetchMock.mockImplementation(async (url) => {
    if (url === '/api/v1/user/recruit-editor/options') return { ...options, teams: [] };
    return undefined;
  });
  renderWithProviders(<RecruitEditor mode="create" />, developer);
  const team = await screen.findByRole('button', { name: '팀 선택' });
  expect(team).toBeDisabled();
  expect(team).toHaveTextContent('연결할 수 있는 팀이 없어요');
  expect(team).toHaveAccessibleDescription('팀이 없으면 모집글을 작성할 수 없습니다.');
  expect(screen.getByRole('button', { name: '모집 글 작성' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

it('adds a role from the "역할 추가" bottom sheet', async () => {
  const user = userEvent.setup();
  renderWithProviders(<RecruitEditor mode="create" />, developer);
  await user.click(await screen.findByRole('button', { name: '역할 추가' }));

  const dialog = await screen.findByRole('dialog', { name: '모집 역할' });
  await user.click(within(dialog).getByRole('radio', { name: '백엔드' }));
  await user.click(within(dialog).getByRole('button', { name: '완료' }));

  // The sheet's own close (history.back()) isn't simulated reliably here, which leaves the rest
  // of the page aria-hidden behind it; see TeamSwitcher.test.tsx, which splits open/close into
  // separate pre-opened-URL tests for the same reason. `hidden: true` reaches the new role row
  // that the dialog's aria-hidden sibling marking would otherwise exclude from the query.
  expect(
    await screen.findByRole('button', { name: '백엔드 인원 늘리기', hidden: true }),
  ).toBeInTheDocument();
});

it('keeps roles with applicants locked when editing', async () => {
  renderWithProviders(<RecruitEditor mode="edit" recruitId="7" />, developer);
  expect(await screen.findByDisplayValue('해커톤 팀원 모집')).toBeVisible();
  expect(screen.getByText('지원자가 있는 역할은 빼거나 바꿀 수 없어요.')).toBeVisible();
  expect(screen.getByRole('button', { name: '백엔드 인원 줄이기' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '백엔드 역할 빼기' })).not.toBeInTheDocument();
  const status = screen.getByRole('region', { name: '모집 관리' });
  expect(within(status).getByRole('button', { name: '모집 마감하기' })).toBeVisible();
  expect(within(status).getByRole('button', { name: '모집 글 삭제' })).toBeVisible();
});
