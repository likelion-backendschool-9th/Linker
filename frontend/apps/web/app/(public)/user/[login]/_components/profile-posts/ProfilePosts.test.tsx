import { screen, waitFor } from '@testing-library/react';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { ProfilePosts } from './ProfilePosts';
import { ProfileTeams } from '../profile-teams/ProfileTeams';

vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));
vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

const post = {
  id: 5,
  author: {
    id: 7,
    login: 'octocat',
    name: '옥토캣',
    avatarUrl: '',
    jobStatus: 'OFF' as const,
  },
  intro: '함께 만든 소개',
  excerpt: '프로필에 보이는 작업물 미리보기입니다.',
  coverUrl: null,
  repoFullName: 'octocat/demo',
  language: 'TypeScript',
  likeCount: 2,
  commentCount: 1,
  createdAt: '2026-11-01T00:00:00Z',
};

describe('profile work sections', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('shows the member posts and links them from the profile', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [post] });
    renderWithProviders(<ProfilePosts login="octocat" />);

    expect(await screen.findByRole('link', { name: '함께 만든 소개' })).toHaveAttribute(
      'href',
      '/posts/5?from=profile',
    );
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/public/user/octocat/posts');
  });

  it('shows active and completed teams', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      items: [{ id: 3, name: '링커', orgAvatarUrl: null, status: 'ACTIVE' }],
    });
    renderWithProviders(<ProfileTeams login="octocat" />);

    expect(await screen.findByRole('link', { name: /링커/ })).toHaveAttribute(
      'href',
      '/teams/3/issues',
    );
    await waitFor(() => expect(screen.getByText('활동 중')).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/public/user/octocat/teams');
  });
});
