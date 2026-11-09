import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render-with-providers';

import { OnboardingForm } from './OnboardingForm';

const apiFetch = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));

const initial = {
  done: false,
  step: 'AGREEMENTS' as const,
  defaults: {
    name: 'Linker Developer',
    bio: 'Building with a team',
    blogUrl: '',
    techStack: ['React'],
    lookingForTeam: false,
    jobStatus: 'OFF' as const,
  },
  emailRequired: false,
  termsVersion: '2026-10-01',
};

describe('OnboardingForm', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    replace.mockReset();
    refresh.mockReset();
    apiFetch.mockResolvedValue(undefined);
  });

  it('validates required agreements, collects the basic profile, and completes through the mock API', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <OnboardingForm
        initial={initial}
        techTags={[
          { id: 1, name: 'React' },
          { id: 2, name: 'TypeScript' },
        ]}
        techStackMax={5}
      />,
    );

    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);

    await user.click(screen.getByLabelText(/이용약관에 동의합니다/));
    await user.click(screen.getByLabelText(/개인정보 처리방침에 동의합니다/));
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/user/onboarding/agreements',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(
      screen.getByRole('heading', { name: '간단한 프로필을 만들어 주세요' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toHaveValue('');
    expect(screen.getByRole('button', { name: '완료' })).toBeDisabled();

    await user.type(screen.getByLabelText('이름'), 'Linker Developer');
    await user.click(screen.getByRole('button', { name: '구직 상태' }));
    const statusSheet = screen.getByRole('dialog', { name: '구직 상태' });
    await user.click(within(statusSheet).getByLabelText('구직 중'));
    await user.click(within(statusSheet).getByRole('button', { name: '완료' }));

    await user.click(screen.getByRole('button', { name: '기술 스택 선택' }));
    const techSheet = screen.getByRole('dialog', { name: '기술 스택' });
    await user.click(within(techSheet).getByLabelText('React'));
    await user.click(within(techSheet).getByRole('button', { name: '완료' }));

    await user.click(screen.getByRole('button', { name: '완료' }));

    expect(apiFetch).toHaveBeenLastCalledWith(
      '/api/v1/user/onboarding/profile',
      expect.objectContaining({ method: 'PUT', body: expect.stringContaining('React') }),
    );
    expect(screen.getByRole('heading', { name: '프로필 설정이 완료됐어요' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '피드로 이동' }));
    expect(replace).toHaveBeenCalledWith('/feed');
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('collects a notification email only when GitHub omitted one', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <OnboardingForm
        initial={{ ...initial, emailRequired: true }}
        techTags={[]}
        techStackMax={5}
      />,
    );

    await user.click(screen.getByLabelText(/이용약관에 동의합니다/));
    await user.click(screen.getByLabelText(/개인정보 처리방침에 동의합니다/));
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByLabelText('알림 이메일')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '간단한 프로필을 만들어 주세요' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('alert')).toHaveTextContent('올바른 이메일 주소를 입력해 주세요.');

    await user.type(screen.getByLabelText('알림 이메일'), 'me@example.com');
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(apiFetch).toHaveBeenLastCalledWith(
      '/api/v1/user/onboarding/email',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ email: 'me@example.com' }),
      }),
    );
    expect(screen.getByRole('heading', { name: '간단한 프로필을 만들어 주세요' })).toBeInTheDocument();
  });
});
