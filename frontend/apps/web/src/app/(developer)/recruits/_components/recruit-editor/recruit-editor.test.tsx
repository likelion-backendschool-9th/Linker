import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { todayKst } from '@/lib/format/time';
import { renderWithProviders } from '@/test/render-with-providers';

import type { EditorOptions, RecruitEditForm } from '../../_lib/editor-queries';
import { RecruitEditor } from './recruit-editor';

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

const developer = { viewer: { role: 'developer' as const, login: 'developer' } };

it('shows required errors on an empty submit with accessible markup', async () => {
  const user = userEvent.setup();
  const { container } = renderWithProviders(<RecruitEditor mode="create" />, developer);
  expect(await screen.findByText('모집 중인 글 1/3개')).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('button', { name: '모집 글 올리기' }));
  expect(await screen.findByText('제목을 입력해 주세요.')).toBeVisible();
  expect(screen.getByText('소개를 입력해 주세요.')).toBeVisible();
  expect(screen.getByText('마감일을 골라 주세요.')).toBeVisible();
  expect(screen.getByLabelText(/^제목/)).toHaveAttribute('aria-invalid', 'true');
  expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/user/recruits', expect.anything());
});

it('requires a region for offline posts and sends the form body', async () => {
  const user = userEvent.setup();
  renderWithProviders(<RecruitEditor mode="create" />, developer);
  await user.type(await screen.findByLabelText(/^제목/), '사이드 프로젝트 팀원 모집');
  await user.type(screen.getByLabelText(/^소개/), '주말에 만나요.');
  await user.type(screen.getByLabelText(/^모집 마감일/), todayKst());
  await user.click(screen.getByRole('radio', { name: '오프라인' }));
  await user.click(screen.getByRole('button', { name: '모집 글 올리기' }));
  expect(await screen.findByText('오프라인 모집은 지역을 입력해 주세요.')).toBeVisible();

  await user.type(screen.getByLabelText(/^지역/), '서울 강남');
  await user.click(screen.getByRole('button', { name: '프론트엔드 인원 늘리기' }));
  await user.click(screen.getByRole('button', { name: '모집 글 올리기' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/recruits/42'));
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
    teamId: null,
  });
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
