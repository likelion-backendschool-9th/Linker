import { fireEvent, screen, waitFor } from '@testing-library/react';

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
    vi.mocked(apiFetch).mockReset().mockResolvedValue({ notificationEmail: 'alerts@example.com' });
  });

  it('opens the inline editor and saves the changed notification email', async () => {
    renderWithProviders(<SettingsCommon login="test" settings={settings} />);

    fireEvent.click(screen.getByRole('button', { name: '알림 이메일 test@example.com' }));
    fireEvent.change(screen.getByLabelText('알림 이메일'), { target: { value: 'alerts@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/v1/user/me/email', expect.anything()));
    await waitFor(() => expect(screen.getByRole('button', { name: '알림 이메일 alerts@example.com' })).toBeVisible());
  });

  it('shows email validation before sending a request', async () => {
    renderWithProviders(<SettingsCommon login="test" settings={settings} />);

    fireEvent.click(screen.getByRole('button', { name: '알림 이메일 test@example.com' }));
    fireEvent.change(screen.getByLabelText('알림 이메일'), { target: { value: 'invalid-email' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('올바른 이메일 주소를 입력해 주세요.')).toBeVisible();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
