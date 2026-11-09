import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { renderWithProviders } from '@/test/render-with-providers';
import { TeamSetupRepositories } from './TeamSetupRepositories';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const data = {
  items: [
    { id: 901, name: 'backend', fullName: 'org/backend', private: false },
    { id: 902, name: 'frontend', fullName: 'org/frontend', private: false },
    { id: 903, name: 'bookstore', fullName: 'org/bookstore', private: true },
  ],
  notInstalledCount: null,
  settingsUrl: 'https://github.com/organizations/org/settings/installations/777',
};
const next = vi.fn();
const external = vi.fn();
function Repositories({
  teamId = 77,
  selected = [],
}: {
  teamId?: number | null;
  selected?: number[];
}) {
  const [ids, setIds] = useState(selected);
  return (
    <TeamSetupRepositories
      teamId={teamId}
      selected={ids}
      onChange={setIds}
      onNext={next}
      openExternal={external}
    />
  );
}
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  next.mockReset();
  external.mockReset();
});

it('retains selections across search and saves only unique IDs returned by the authorized list', async () => {
  vi.mocked(apiFetch).mockImplementation(async (_url, init) =>
    init?.method === 'PUT' ? undefined : data,
  );
  renderWithProviders(<Repositories selected={[999, 901, 901]} />);
  expect(await screen.findByRole('checkbox', { name: 'backend' })).toBeChecked();
  fireEvent.change(screen.getByRole('searchbox', { name: '저장소 검색' }), {
    target: { value: 'BOOK' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'bookstore' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
  expect(screen.getByRole('checkbox', { name: 'backend' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'bookstore' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams/77/setup/repos',
    expect.objectContaining({ method: 'PUT', body: JSON.stringify({ repoIds: [901, 903] }) }),
  );
});

it('keeps the selection and current step when saving fails, then allows an explicit retry', async () => {
  let fail = true;
  vi.mocked(apiFetch).mockImplementation(async (_url, init) => {
    if (init?.method === 'PUT') {
      if (fail)
        throw new ApiError(503, {
          code: 'SERVICE_UNAVAILABLE',
          message: '잠시 후 다시 시도해 주세요',
        });
      return undefined;
    }
    return data;
  });
  renderWithProviders(<Repositories />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'backend' }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요');
  expect(screen.getByRole('checkbox', { name: 'backend' })).toBeChecked();
  expect(next).not.toHaveBeenCalled();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
});

it('does not list or save without a team returned by setup navigation', () => {
  renderWithProviders(<Repositories teamId={null} />);
  expect(apiFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
});

it('does not save when the server rejects repository access', async () => {
  vi.mocked(apiFetch).mockRejectedValue(
    new ApiError(403, { code: 'FORBIDDEN', message: '팀 오너만 사용할 수 있어요' }),
  );
  renderWithProviders(<Repositories selected={[901]} />);
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(next).not.toHaveBeenCalled();
  expect(vi.mocked(apiFetch).mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
});

it('uses the server settings URL only in the empty/search-empty state without inventing counts', async () => {
  vi.mocked(apiFetch).mockResolvedValue(data);
  renderWithProviders(<Repositories />);
  await screen.findByRole('checkbox', { name: 'backend' });
  expect(
    screen.queryByRole('button', { name: 'GitHub에서 접근 허용하기' }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
  fireEvent.click(screen.getByRole('button', { name: 'GitHub에서 접근 허용하기' }));
  expect(external).toHaveBeenCalledWith(data.settingsUrl);
  expect(screen.queryByText(/접근이 허용되지 않은 레포/)).not.toBeInTheDocument();
});
