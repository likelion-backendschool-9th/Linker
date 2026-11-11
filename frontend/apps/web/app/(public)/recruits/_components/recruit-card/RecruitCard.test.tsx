import { render, screen } from '@testing-library/react';
import type { Route } from 'next';

import { RECRUIT } from '@/lib/policy';

import { RecruitCard, type RecruitCardData } from './RecruitCard';

const base: RecruitCardData = {
  id: '3',
  href: '/recruits/3' as Route,
  format: '온라인',
  goal: '공모전',
  deadlineLabel: '2026.11.16 마감',
  deadlineFullLabel: '2026년 11월 16일 마감',
  title: '공연 정보 플랫폼',
  roles: ['Backend 1명'],
  recruitingRoleLabel: '백엔드 1명',
  techStack: ['Java', 'Spring'],
};

it('shows a short intro whole, with no "자세히 보기" link', () => {
  render(
    <RecruitCard recruit={{ ...base, description: '같이 만들 분을 찾아요.\n주 1회 만나요.' }} />,
  );

  expect(screen.getByText('같이 만들 분을 찾아요. 주 1회 만나요.')).toBeVisible();
  expect(screen.queryByRole('link', { name: /자세히 보기/ })).not.toBeInTheDocument();
});

it('cuts a long intro at the preview length and links "...자세히 보기" to the post (POL-R-2)', () => {
  const intro = '가'.repeat(RECRUIT.cardIntroPreview + 30);
  render(<RecruitCard recruit={{ ...base, description: intro }} />);

  const paragraph = screen.getByText(
    (_, node) => node?.tagName === 'P' && node.textContent?.startsWith('가') === true,
  );
  expect(paragraph.textContent).toBe(
    `${'가'.repeat(RECRUIT.cardIntroPreview)}...자세히 보기 (공연 정보 플랫폼 모집글 전체 보기)`,
  );
  expect(screen.getByRole('link', { name: /자세히 보기/ })).toHaveAttribute('href', '/recruits/3');
});
