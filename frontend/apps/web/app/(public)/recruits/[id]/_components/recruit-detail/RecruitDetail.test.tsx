import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { todayKst } from '@/lib/format/time';
import { renderWithProviders } from '@/test/render-with-providers';

import type {
  ApplicantRow,
  ApplicationDetail,
  RecruitDetail as Detail,
} from '../../_lib/detail-queries';
import { recruitSummary } from '../../_lib/recruit-summary';
import { RecruitDetail } from './RecruitDetail';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const author = { id: 1, login: 'linker', name: '김링커', avatarUrl: '/mock/avatar.png' };
const base: Detail = {
  id: 1,
  title: 'Linker 해커톤팀 백엔드/디자이너 모집',
  author,
  authorCard: { ...author, bio: '끝까지 만드는 걸 좋아해요.' },
  format: 'ONLINE',
  region: null,
  goal: 'HACKATHON',
  deadline: '2099-12-31',
  status: 'OPEN',
  techTags: ['Next.js', 'Spring Boot'],
  roles: [
    { id: 11, role: 'BACKEND', name: '백엔드', headcount: 2, filled: 1, remaining: 1 },
    { id: 12, role: 'DESIGN', name: '디자이너', headcount: 1, filled: 1, remaining: 0 },
  ],
  createdAt: '2026-10-29T00:00:00Z',
  intro: '2주 뒤 데모데이를 목표로 해요.',
  duration: '2주',
  teamName: 'Linker',
  isAuthor: false,
  isTeamMember: false,
  myApplication: null,
  applicantCount: 1,
};

const applicant: ApplicantRow = {
  id: 9,
  applicant: { id: 7, login: 'taeyang', name: '정태양', avatarUrl: '/mock/avatar.png' },
  roleId: 12,
  roleName: '디자이너',
  status: 'PENDING',
  appliedAt: '2026-10-30T00:00:00Z',
  daysLeft: 12,
};

const application: ApplicationDetail = {
  id: 9,
  status: 'PENDING',
  message: '디자인 시스템을 만들어 봤어요.',
  appliedAt: '2026-10-30T00:00:00Z',
  applicant: applicant.applicant,
  techStack: ['Figma'],
  completion: { projectCount: 2, issueCompletionRate: 0.82 },
  contributions: [
    { date: '2026-11-01', count: 3 },
    { date: '2026-11-02', count: 0 },
  ],
  posts: [],
};

function serve(detail: Detail, accept?: () => unknown) {
  fetchMock.mockImplementation(async (url) => {
    if (url === '/api/v1/public/recruits/1') return detail;
    if (url.endsWith('/applications')) return { items: [applicant] };
    if (url.endsWith('/applications/9')) return application;
    if (url.endsWith('/accept')) return accept?.();
    return { id: 99, status: 'PENDING' };
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});

it('shows the post to guests and sends "지원하기" to the login prompt', async () => {
  serve(base);
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  const { container } = renderWithProviders(<RecruitDetail recruitId="1" />, { onUrlUpdate });
  expect(await screen.findByRole('heading', { name: base.title })).toBeVisible();
  expect(screen.getByText('1명 남음')).toBeVisible();
  expect(screen.getByText('모집 완료')).toBeVisible();
  expect(screen.getByText('끝까지 만드는 걸 좋아해요.')).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('button', { name: '지원하기' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=login') }),
    ),
  );
});

it('lets a developer apply with one open role and a message', async () => {
  serve(base);
  const user = userEvent.setup();
  renderWithProviders(<RecruitDetail recruitId="1" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  await user.click(await screen.findByRole('button', { name: '지원하기' }));
  const dialog = await screen.findByRole('dialog', { name: '지원하기' });
  // Only one role is open, so it's already chosen; the full one is disabled
  expect(within(dialog).getByRole('radio', { name: /백엔드/ })).toBeChecked();
  expect(within(dialog).getByRole('radio', { name: /디자이너/ })).toBeDisabled();
  await user.type(within(dialog).getByLabelText(/하고 싶은 말/), '주말에 가능해요.');
  await user.click(within(dialog).getByRole('button', { name: '지원하기' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/recruits/1/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: 11, message: '주말에 가능해요.' }),
    }),
  );
});

it('shows a pending application with cancel, and nothing for recruiters', async () => {
  serve({ ...base, myApplication: { id: 4, status: 'PENDING', roleId: 11, teamChatRoomId: null } });
  const { unmount } = renderWithProviders(<RecruitDetail recruitId="1" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  expect(await screen.findByText('검토 중')).toBeVisible();
  expect(screen.getByText('지원 역할 백엔드')).toBeVisible();
  expect(screen.getByRole('button', { name: '지원 취소' })).toBeVisible();
  unmount();

  serve(base);
  renderWithProviders(<RecruitDetail recruitId="1" />, {
    viewer: { role: 'recruiter', login: 'recruiter' },
  });
  expect(await screen.findByRole('heading', { name: base.title })).toBeVisible();
  expect(screen.queryByRole('button', { name: '지원하기' })).not.toBeInTheDocument();
});

it('gives the author an applicants tab and the role-full sheet on accept', async () => {
  serve({ ...base, isAuthor: true }, () => {
    throw new ApiError(409, { code: 'ROLE_FULL', message: '이 역할은 이미 다 찼어요' });
  });
  const user = userEvent.setup();
  const { container } = renderWithProviders(<RecruitDetail recruitId="1" />, {
    viewer: { role: 'developer', login: 'linker' },
    searchParams: '?tab=applicants',
  });
  const card = await screen.findByRole('article', { name: '정태양' });
  expect(within(card).getByText('12일 뒤 자동으로 만료돼요')).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await user.click(within(card).getByRole('button', { name: '지원서 보기: 정태양' }));
  const sheet = await screen.findByRole('dialog', { name: '지원서' });
  expect(within(sheet).getByText('디자인 시스템을 만들어 봤어요.')).toBeVisible();
  expect(within(sheet).getByText('82%')).toBeVisible();
  await user.click(within(sheet).getByRole('button', { name: '수락' }));
  expect(await screen.findByRole('dialog', { name: '이 역할은 자리가 다 찼어요' })).toBeVisible();
  expect(screen.getByText('디자이너 1명 → 2명')).toBeVisible();
});

it('summarizes remaining roles and the deadline', () => {
  expect(recruitSummary({ ...base, deadline: todayKst() })).toBe('백엔드 1명 남음 · 오늘 마감');
  expect(recruitSummary({ ...base, roles: [base.roles[1]!] })).toMatch(/^모집 완료 · D-\d+$/);
  expect(recruitSummary({ ...base, status: 'CLOSED' })).toBe('모집 마감');
});
