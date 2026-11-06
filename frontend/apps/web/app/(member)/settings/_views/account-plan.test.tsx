import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render-with-providers';

import type { SettingsData } from '../_lib/settings-types';
import { AccountPlan } from './SettingsCommon';

const settings: SettingsData = {
  github: null,
  notificationEmail: 'test@example.com',
  pushEnabled: false,
  plan: { name: 'Free', label: '무료', kind: 'PRO' },
};

it('links the current plan to subscription management', () => {
  renderWithProviders(<AccountPlan settings={settings} />);

  expect(screen.getByRole('link', { name: '구독 관리' })).toHaveAttribute(
    'href',
    '/settings/subscription',
  );
  expect(screen.getByText('무료')).toBeInTheDocument();
});
