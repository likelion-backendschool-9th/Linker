import { screen } from '@testing-library/react';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { RecruiterOfferSummary } from './recruiter-offer-summary';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

it('shows the offer counts, latest developers, and the full list', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    talkingCount: 1,
    waitingCount: 2,
    todayUsed: 3,
    todayLimit: 10,
    scoutTodayLimit: 50,
    scoutSubscribed: false,
    latest: [
      {
        roomId: 30,
        developer: { id: 4, login: 'ada', name: '에이다', avatarUrl: null },
        status: 'WAITING',
        sentAt: '2026-11-01T00:00:00Z',
      },
    ],
  });
  renderWithProviders(<RecruiterOfferSummary />);

  expect(await screen.findByText('대화 중 1')).toBeInTheDocument();
  expect(screen.getByText('응답 대기 2')).toBeInTheDocument();
  expect(screen.getByText('오늘 남은 제안 7/10')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /에이다/ })).toHaveAttribute('href', '/u/ada');
  expect(screen.getByRole('link', { name: '전체 보기' })).toHaveAttribute('href', '/recruiter/offers');
});
