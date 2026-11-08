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

  it('opens from the URL with the Figma copy and no axe violations', async () => {
    renderWithProviders(<LoginPromptSheet />, {
      searchParams: '?overlay=login&returnTo=/workspace',
    });

    const dialog = await screen.findByRole('dialog', {
      name: '로그인 하기',
    });
    expect(dialog).toHaveTextContent(
      '해당 기능은 로그인한 사용자들만 사용할 수 있습니다.로그인 하시겠습니까?',
    );
    expect(screen.getByRole('button', { name: '로그인하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소하기' })).toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole('button', { name: '로그인하기' }));
    expect(startGithubLogin).toHaveBeenCalledWith('/workspace');
  });

  it('opens on LOGIN_REQUIRED and stores the page being viewed', async () => {
    window.history.replaceState(null, '', '/posts/1');
    useAppSignalStore.setState({ loginRequestedAt: 1 });
    const updates: UrlUpdateEvent[] = [];
    renderWithProviders(<LoginPromptSheet />, { onUrlUpdate: (event) => updates.push(event) });

    expect(await screen.findByRole('dialog', { name: '로그인 하기' })).toBeInTheDocument();
    await waitFor(() =>
      expect(updates.some((event) => event.searchParams.get('returnTo') === '/posts/1')).toBe(true),
    );
  });
});
