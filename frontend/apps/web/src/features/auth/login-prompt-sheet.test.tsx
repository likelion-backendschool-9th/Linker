import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/test/render-with-providers';

import { LoginPromptSheet } from './login-prompt-sheet';

describe('LoginPromptSheet', () => {
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
});
