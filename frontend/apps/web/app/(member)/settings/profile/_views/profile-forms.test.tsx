import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render-with-providers';

import { DeveloperProfileForm } from './DeveloperProfileForm';
import { RecruiterProfileForm } from './RecruiterProfileForm';

const apiFetch = vi.fn();
const refresh = vi.fn();
const replace = vi.fn();

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, replace }) }));

const developerInitial = {
  kind: 'DEVELOPER' as const,
  name: '한서준',
  bio: '프론트엔드 개발자',
  blogUrl: '',
  techStack: ['React'],
  lookingForTeam: true,
  jobStatus: 'OPEN' as const,
  jobCategories: [],
};

const recruiterInitial = {
  kind: 'RECRUITER' as const,
  name: '송지현',
  company: '넥스트랩',
  jobTitle: '테크 리크루터',
  websiteUrl: 'https://nextlab.example',
  companyEmail: 'jihyun.song@nextlab.example',
};

describe('profile edit forms', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    refresh.mockReset();
    replace.mockReset();
    apiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return JSON.parse(String(init.body));
      if (url.endsWith('github-sync'))
        return { ...developerInitial, name: 'GitHub 이름', syncedAt: '2026-10-31' };
      return undefined;
    });
  });

  it('limits developer job categories and saves only the documented editable fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DeveloperProfileForm
        initial={developerInitial}
        login="seojun-han"
        avatarUrl={null}
        techTags={[{ id: 1, name: 'React' }]}
        jobCategories={[
          { key: 'FRONTEND', label: '프론트엔드' },
          { key: 'BACKEND', label: '백엔드' },
          { key: 'FULLSTACK', label: '풀스택' },
          { key: 'MOBILE', label: '모바일(iOS/Android)' },
        ]}
      />,
      { viewer: { role: 'developer', login: 'seojun-han' } },
    );

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '관심있는 직군을 선택해 주세요' }));
    await user.click(screen.getByLabelText('프론트엔드'));
    await user.click(screen.getByLabelText('백엔드'));
    await user.click(screen.getByLabelText('풀스택'));
    expect(screen.getByLabelText('모바일(iOS/Android)')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '완료' }));
    screen.getByRole('button', { name: '저장', hidden: true }).click();

    let init: RequestInit | undefined;
    await waitFor(() => {
      init = apiFetch.mock.calls.find(
        ([url, request]) => url === '/api/v1/user/me/profile' && request?.method === 'PATCH',
      )?.[1];
      expect(init).toBeDefined();
    });
    expect(JSON.parse(String(init!.body))).toMatchObject({
      name: '한서준',
      jobCategories: ['FRONTEND', 'BACKEND', 'FULLSTACK'],
    });
    expect(JSON.parse(String(init!.body))).not.toHaveProperty('kind');
  });

  it('keeps recruiter email immutable and omits developer-only fields from saves', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RecruiterProfileForm initial={recruiterInitial} login="r-1001" avatarUrl={null} />,
      { viewer: { role: 'recruiter', login: 'r-1001' } },
    );

    expect(screen.getByLabelText('회사 이메일')).toHaveValue(recruiterInitial.companyEmail);
    expect(screen.getByLabelText('회사 이메일')).toHaveAttribute('readonly');
    expect(screen.queryByText('기술 스택')).not.toBeInTheDocument();
    expect(screen.queryByText('GitHub에서 다시 불러오기')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('회사명'));
    await user.type(screen.getByLabelText('회사명'), '새 회사');
    await user.click(screen.getByRole('button', { name: '저장' }));

    let init: RequestInit | undefined;
    await waitFor(() => {
      init = apiFetch.mock.calls.find(
        ([url, request]) => url === '/api/v1/recruiter/me/profile' && request?.method === 'PATCH',
      )?.[1];
      expect(init).toBeDefined();
    });
    const body = JSON.parse(String(init!.body));
    expect(body.company).toBe('새 회사');
    expect(body).not.toHaveProperty('companyEmail');
    expect(body).not.toHaveProperty('techStack');
  });
});
