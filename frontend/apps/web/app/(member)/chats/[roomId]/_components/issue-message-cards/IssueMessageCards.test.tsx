import { render, screen } from '@testing-library/react';

import { IssueMessageCards } from './IssueMessageCards';

it('opens the Linker issue detail using its database ID and displays current status', () => {
  const { rerender } = render(<IssueMessageCards cards={[{ canView: true, issueId: 1015, teamId: 1, repoId: 11, number: 15, repoName: 'linker-web', title: '피드 카드', status: 'IN_PROGRESS' }]} />);
  expect(screen.getByRole('link', { name: /피드 카드.*진행 중/ })).toHaveAttribute('href', '/teams/1/issues/1015');
  rerender(<IssueMessageCards cards={[{ canView: true, issueId: 1015, teamId: 1, repoId: 11, number: 15, repoName: 'linker-web', title: '피드 카드', status: 'DONE' }]} />);
  expect(screen.getByRole('link', { name: /피드 카드.*완료/ })).toBeVisible();
});
it('shows only a title without a link when the repository is unavailable to the viewer', () => {
  render(<IssueMessageCards cards={[{ canView: false, title: '제한된 이슈 제목' }]} />);
  expect(screen.getByText('제한된 이슈 제목')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
