import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { RepoTemplateStep } from './repo-template-step';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('/issue-create/repos')) {
      return {
        items: [
          { id: 11, name: 'linker-web', fullName: 'a/linker-web', canWrite: true },
          { id: 12, name: 'linker-api', fullName: 'a/linker-api', canWrite: false },
        ],
      };
    }
    return {
      items: [
        { key: 'default:task', source: 'DEFAULT', name: '작업', description: '해야 할 일' },
        { key: 'repo:bug', source: 'REPO', name: '버그 제보', description: '문제' },
      ],
    };
  });
});

it('offers writable repos only and lists repo templates above the defaults, accessibly', async () => {
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
  expect(await screen.findByRole('radio', { name: /linker-api.*쓰기 권한 없음/ })).toBeDisabled();
  // Only one writable repo: chosen already
  expect(screen.getByRole('radio', { name: /linker-web/ })).toBeChecked();
  const groups = (await screen.findAllByText(/템플릿$/, { selector: 'p' })).map(
    (el) => el.textContent,
  );
  expect(groups).toEqual(['레포 템플릿', '기본 템플릿']);
  expect(await axe(container)).toHaveNoViolations();

  await userEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(screen.getByText('템플릿을 골라 주세요.')).toBeVisible();
  await userEvent.click(screen.getByRole('radio', { name: /버그 제보/ }));
  expect(onSelect).toHaveBeenLastCalledWith(11, 'repo:bug');
  await userEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(onNext).toHaveBeenCalledWith(11, 'repo:bug');
});

it('says so when no linked repo is writable', async () => {
  fetchMock.mockImplementation(async () => ({
    items: [{ id: 21, name: 'study', fullName: 'b/study', canWrite: false }],
  }));
  renderWithProviders(
    <RepoTemplateStep
      teamId="2"
      repoId={null}
      templateKey={null}
      onSelect={vi.fn()}
      onNext={vi.fn()}
    />,
  );
  expect(await screen.findByText('이슈를 만들 수 있는 레포가 없어요.')).toBeVisible();
});
