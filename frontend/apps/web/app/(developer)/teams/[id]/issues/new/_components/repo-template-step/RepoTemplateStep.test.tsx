import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { RepoTemplateStep } from './RepoTemplateStep';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith('/issue-filters')) {
      return {
        repos: [
          { id: 11, name: 'linker-web' },
          { id: 12, name: 'linker-api' },
          { id: 13, name: 'linker-app' },
        ],
        labels: [],
        members: [],
        statuses: [],
      };
    }
    if (String(url).includes('/issue-templates?')) {
      return {
        templates: [
          { key: 'default:task', source: 'DEFAULT', name: '작업', description: '해야 할 일' },
          { key: 'repo:bug', source: 'REPO', name: '버그 제보', description: '문제' },
          { key: 'org:feature', source: 'ORG', name: '기능', description: '조직' },
        ],
        assigneeCandidates: [],
        labelOptions: [],
        maxAssignees: 10,
      };
    }
    return { templates: [], assigneeCandidates: [], labelOptions: [], maxAssignees: 10 };
  });
});

it('lists repos from issue-filters, then repo and org templates above the defaults', async () => {
  const onSelect = vi.fn();
  const onNext = vi.fn();
  const { container } = renderWithProviders(
    <RepoTemplateStep
      teamId="1"
      repoId={null}
      templateKey={null}
      onSelect={onSelect}
      onNext={onNext}
    />,
  );
  expect(await screen.findByRole('radio', { name: 'linker-web' })).toBeVisible();
  expect(screen.getByRole('radio', { name: 'linker-app' })).toBeVisible();
  expect(screen.getByRole('radio', { name: 'linker-api' })).toBeVisible();
  expect(screen.getByRole('button', { name: '다음' })).toHaveAttribute('aria-disabled', 'true');

  await userEvent.click(screen.getByRole('radio', { name: 'linker-web' }));
  const templateNames = (await screen.findAllByRole('radio'))
    .filter((item) => item.getAttribute('name')?.includes('template'))
    .map((item) => item.closest('label')?.textContent);
  expect(templateNames).toEqual(['버그 제보', '기능', '작업']);
  expect(await axe(container)).toHaveNoViolations();

  await userEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(onNext).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('radio', { name: '버그 제보' }));
  expect(onSelect).toHaveBeenLastCalledWith(11, 'repo:bug');
  await userEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(onNext).toHaveBeenCalledWith(11, 'repo:bug');
});
