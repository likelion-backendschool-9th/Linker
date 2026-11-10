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

  it('shows recruiters home and chats only', () => {
    renderWithProviders(<BottomTabBar tabs={tabsFor('recruiter')} />, {
      viewer: { role: 'recruiter', login: 'r-12' },
    });
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '홈 피드',
      '채팅방',
    ]);
  });

  it('adds a 프로필 tab with the viewer’s stored avatar for signed-in developers', () => {
    const avatarUrl = 'https://avatars.githubusercontent.com/u/583231?v=4';
    renderWithProviders(
      <BottomTabBar tabs={tabsFor('developer', { login: 'yunsu', avatarUrl })} />,
      { viewer: { role: 'developer', login: 'yunsu' } },
    );
    const profileLink = screen.getByRole('link', { name: '프로필' });
    expect(profileLink).toHaveAttribute('href', '/user/yunsu');
    // next/image rewrites src to /_next/image?url=…; the original URL must be the stored one.
    const src = profileLink.querySelector('img')?.getAttribute('src') ?? '';
    expect(src).toContain(encodeURIComponent(avatarUrl));
  });

  it('shows an icon on the 프로필 tab when the account has no photo', () => {
    renderWithProviders(
      <BottomTabBar tabs={tabsFor('developer', { login: 'yunsu', avatarUrl: null })} />,
      { viewer: { role: 'developer', login: 'yunsu' } },
    );
    const profileLink = screen.getByRole('link', { name: '프로필' });
    expect(profileLink.querySelector('img')).toBeNull();
    expect(profileLink.querySelector('svg, span')).not.toBeNull();
  });
});
