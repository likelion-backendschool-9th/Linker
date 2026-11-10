import { fireEvent, screen } from '@testing-library/react';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { SettingsData } from '../_lib/settings-types';
import { SettingsCommon } from './SettingsCommon';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

const settings: SettingsData = {
  github: null,
  notificationEmail: 'test@example.com',
  pushEnabled: false,
  plan: { name: 'Flex', label: 'Flex 5/6명', kind: 'FLEX' },
};

describe('settings email row', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('shows the email as read-only information', () => {
    renderWithProviders(<SettingsCommon login="test" settings={settings} />);

    expect(screen.getByText('이메일')).toBeVisible();
    const email = screen.getByText('test@example.com');
    expect(email).toBeVisible();

    fireEvent.click(email);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalledWith('/api/v1/user/me/email', expect.anything());
  });
});
