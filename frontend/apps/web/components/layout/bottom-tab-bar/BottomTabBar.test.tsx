import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UrlUpdateEvent } from 'nuqs/adapters/testing';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/test/render-with-providers';

import { BottomTabBar } from './BottomTabBar';
import { tabsFor } from '../bottom-tabs.config';

describe('BottomTabBar', () => {
  it('gives guests login buttons for workspace and chats', async () => {
    const updates: UrlUpdateEvent[] = [];
    const { container } = renderWithProviders(<BottomTabBar tabs={tabsFor('guest')} />, {
      onUrlUpdate: (event) => updates.push(event),
    });

    expect(screen.getByRole('navigation', { name: '주 메뉴' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈 피드' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '팀 찾기' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '오피스' }));
    expect(updates.at(-1)?.searchParams.get('overlay')).toBe('login');
    expect(updates.at(-1)?.searchParams.get('returnTo')).toBe('/workspace');

    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows recruiters home and chats only (profile lives in the header)', () => {
    renderWithProviders(<BottomTabBar tabs={tabsFor('recruiter')} />, {
      viewer: { role: 'recruiter', login: 'r-12' },
    });
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '홈 피드',
      '채팅방',
    ]);
  });
});
