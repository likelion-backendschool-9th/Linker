import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { startGithubLogin } from '@/features/auth/start-github-login';
import { toast } from '@/stores/toast-store';
import { renderWithProviders } from '@/test/render-with-providers';

import type { Invite } from '../../_lib/get-invite';
import { acceptInvite } from './api';
import { InviteAcceptArea } from './InviteAcceptArea';

vi.mock('./api', () => ({ acceptInvite: vi.fn() }));
vi.mock('@/features/auth/start-github-login', () => ({ startGithubLogin: vi.fn() }));
vi.mock('@/stores/toast-store', () => ({ toast: vi.fn() }));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
}));

const base: Invite = {
  code: 'demo-valid',
  status: 'VALID',
  team: { id: 2 },
  participation: { state: 'ELIGIBLE' },
};

beforeEach(() => {
  replace.mockReset();
  vi.mocked(acceptInvite).mockReset();
  vi.mocked(startGithubLogin).mockReset();
  vi.mocked(toast).mockReset();
  vi.mocked(startGithubLogin).mockResolvedValue(undefined);
  vi.mocked(acceptInvite).mockResolvedValue({
    teamId: 2,
    orgLogin: 'linker-demo',
    needsGithubInvite: true,
  });
});

it('renders the Figma slim landing copy', () => {
  renderWithProviders(<InviteAcceptArea invite={base} />, { viewer: { role: 'guest' } });
  expect(screen.getByRole('heading', { name: 'linker' })).toBeVisible();
  expect(screen.getByText('개발자 SNS의 새로운 패러다임')).toBeVisible();
  expect(screen.getByRole('button', { name: '팀에 합류 하기' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'GitHub로 빠르게 시작하기' })).toBeVisible();
});

it('starts GitHub login for guests on join', async () => {
  renderWithProviders(<InviteAcceptArea invite={base} />, { viewer: { role: 'guest' } });
  await userEvent.click(screen.getByRole('button', { name: '팀에 합류 하기' }));
  expect(startGithubLogin).toHaveBeenCalledWith('/invite/demo-valid');
});

it('accepts for developers and routes to team issues', async () => {
  renderWithProviders(<InviteAcceptArea invite={base} />, { viewer: { role: 'developer' } });
  await userEvent.click(screen.getByRole('button', { name: '팀에 합류 하기' }));
  await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith('demo-valid'));
  expect(replace).toHaveBeenCalledWith('/teams/2/issues');
});

it('blocks recruiters with the policy toast and keeps the landing', async () => {
  renderWithProviders(<InviteAcceptArea invite={base} />, { viewer: { role: 'recruiter' } });
  expect(screen.getByRole('button', { name: '팀에 합류 하기' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: '팀에 합류 하기' }));
  expect(toast).toHaveBeenCalledWith('개발자 계정만 팀에 참여할 수 있어요', { tone: 'error' });
  expect(acceptInvite).not.toHaveBeenCalled();
  expect(startGithubLogin).not.toHaveBeenCalled();
});

it('sends already-member developers to the team issues screen', async () => {
  renderWithProviders(
    <InviteAcceptArea invite={{ ...base, participation: { state: 'ALREADY_MEMBER' } }} />,
    { viewer: { role: 'developer' } },
  );
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/teams/2/issues'));
});
