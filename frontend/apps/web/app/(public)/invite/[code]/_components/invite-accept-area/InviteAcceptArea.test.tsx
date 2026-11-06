import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render-with-providers';
import { InviteAcceptArea } from './InviteAcceptArea';

it.each(['developer', 'operator'] as const)(
  '%s uses the developer invitation view outside the back office',
  (role) => {
    renderWithProviders(
      <InviteAcceptArea
        code="valid"
        teamId={1}
        participation={{ state: 'ELIGIBLE', canManageTeam: false }}
      />,
      { viewer: { role } },
    );
    expect(screen.getByRole('button', { name: '팀에 참여하기' })).toBeDisabled();
    expect(
      screen.getByText('팀 참여 기능은 준비 중이에요. 아직 팀에 가입되지 않아요.'),
    ).toBeVisible();
  },
);
it('recruiters cannot use a developer invitation even when the team has space', () => {
  renderWithProviders(
    <InviteAcceptArea
      code="valid"
      teamId={1}
      participation={{ state: 'ELIGIBLE', canManageTeam: false }}
    />,
    { viewer: { role: 'recruiter' } },
  );
  expect(screen.getByText('개발자 계정만 팀에 참여할 수 있어요')).toBeVisible();
  expect(screen.queryByRole('button', { name: '팀에 참여하기' })).not.toBeInTheDocument();
});
