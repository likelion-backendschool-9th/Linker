import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getMyProfile, updateMyProfile } from '@linker/api/p05-profile-edit/p05-profile-edit';
import { profileQueryKey } from '@/features/profile/profile-types';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { SettingsData } from '../_lib/settings-types';
import { DeveloperSettingsView } from './DeveloperSettingsView';

vi.mock('@linker/api/p05-profile-edit/p05-profile-edit', () => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}));

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

const settings: SettingsData = {
  github: { login: 'seojun-han', connected: true },
  notificationEmail: 'seojun@example.com',
  pushEnabled: false,
  plan: { name: 'Flex', label: 'Flex 5/6명', kind: 'FLEX' },
};

const profile = {
  name: '한서준',
  bio: '프론트엔드 개발자',
  blogUrl: '',
  techStack: ['React'],
  lookingForTeam: true,
  jobCategories: ['FRONTEND'],
};

describe('developer settings job status', () => {
  beforeEach(() => {
    vi.mocked(getMyProfile).mockReset();
    vi.mocked(updateMyProfile).mockReset();
    vi.mocked(apiFetch).mockReset();
    vi.mocked(getMyProfile).mockResolvedValue(profile);
    vi.mocked(updateMyProfile).mockImplementation(async (body) => body);
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (String(url).startsWith('/api/v1/public/user/')) {
        return { login: 'seojun-han', name: '한서준', jobStatus: 'SEEKING' };
      }
      return undefined;
    });
  });

  it('writes the saved job status into the profile cache before the sheet closes', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <DeveloperSettingsView login="seojun-han" settings={settings} jobStatus="SEEKING" blockCount={0} />,
      { searchParams: '?overlay=profile-edit-job' },
    );
    queryClient.setQueryData(profileQueryKey('seojun-han'), {
      login: 'seojun-han',
      name: '한서준',
      jobStatus: 'SEEKING',
    });

    await user.click(screen.getByRole('radio', { name: '구직 안 함' }));
    await user.click(screen.getByRole('button', { name: '완료' }));

    await waitFor(() => {
      expect(queryClient.getQueryData(profileQueryKey('seojun-han'))).toMatchObject({
        login: 'seojun-han',
        name: '한서준',
        jobStatus: 'OFF',
      });
    });
  });

  it('seeds an empty profile cache from the public profile with the saved status', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <DeveloperSettingsView login="seojun-han" settings={settings} jobStatus="SEEKING" blockCount={0} />,
      { searchParams: '?overlay=profile-edit-job' },
    );

    await user.click(screen.getByRole('radio', { name: '구직 안 함' }));
    await user.click(screen.getByRole('button', { name: '완료' }));

    await waitFor(() => {
      expect(queryClient.getQueryData(profileQueryKey('seojun-han'))).toMatchObject({
        login: 'seojun-han',
        jobStatus: 'OFF',
      });
    });
  });
});
