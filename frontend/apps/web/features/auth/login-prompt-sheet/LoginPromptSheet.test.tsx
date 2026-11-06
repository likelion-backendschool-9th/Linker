import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import type { UrlUpdateEvent } from 'nuqs/adapters/testing';

import { renderWithProviders } from '@/test/render-with-providers';
import { useAppSignalStore } from '@/stores/app-signal-store';

import { LoginPromptSheet } from './LoginPromptSheet';
import { startGithubLogin } from '../start-github-login';

vi.mock('../start-github-login', () => ({ startGithubLogin: vi.fn() }));

describe('LoginPromptSheet', () => {
  beforeEach(() => {
    useAppSignalStore.setState({ loginRequestedAt: 0 });
    vi.mocked(startGithubLogin).mockReset();
    vi.mocked(startGithubLogin).mockResolvedValue(undefined);
  });

  it('opens from the URL with the policy copy and no axe violations', async () => {
    renderWithProviders(<LoginPromptSheet />, {
      searchParams: '?overlay=login&returnTo=/workspace',
    });

    const dialog = await screen.findByRole('dialog', {
      name: '로그인한 사용자만 쓸 수 있는 기능이에요',
    });
    expect(screen.getByRole('button', { name: 'GitHub로 시작' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '채용 담당자 로그인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
    expect(await axe(dialog)).toHaveNoViolations();
  });

  it('stays closed without the overlay param', () => {
    renderWithProviders(<LoginPromptSheet />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sends GitHub login back to the stored returnTo', async () => {
    renderWithProviders(<LoginPromptSheet />, {
      searchParams: '?overlay=login&returnTo=/workspace',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'GitHub로 시작' }));
    expect(startGithubLogin).toHaveBeenCalledWith('/workspace');
  });

  it('opens on LOGIN_REQUIRED and stores the page being viewed', async () => {
    window.history.replaceState(null, '', '/posts/1');
    useAppSignalStore.setState({ loginRequestedAt: 1 });
    const updates: UrlUpdateEvent[] = [];
    renderWithProviders(<LoginPromptSheet />, { onUrlUpdate: (event) => updates.push(event) });

    expect(
      await screen.findByRole('dialog', { name: '로그인한 사용자만 쓸 수 있는 기능이에요' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(updates.some((event) => event.searchParams.get('returnTo') === '/posts/1')).toBe(true),
    );
  });
});
