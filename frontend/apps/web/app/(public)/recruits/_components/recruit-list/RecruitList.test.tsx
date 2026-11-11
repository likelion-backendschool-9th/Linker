import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { RecruitList } from './RecruitList';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ items: [], nextCursor: null });
});

/** Area B: search form → its inner wrapper → the panel, whose `data-pinned` keeps it open at the top */
const panel = () => screen.getByRole('search').parentElement!.parentElement!;

it('searches only on Enter or the magnifier, never while typing (POL-R-2)', async () => {
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<RecruitList />, { onUrlUpdate });

  const field = screen.getByRole('searchbox', { name: '검색어를 입력해 주세요' });
  await user.type(field, 'React');
  // Well past the old 300 ms pause: nothing was written to the URL
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(onUrlUpdate).not.toHaveBeenCalledWith(
    expect.objectContaining({ queryString: expect.stringContaining('q=') }),
  );

  await user.type(field, '{Enter}');
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('q=React') }),
    ),
  );

  await user.clear(field);
  await user.type(field, 'Spring');
  await user.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('q=Spring') }),
    ),
  );
});

it('keeps area B open at the top while a search or filter is in the URL', () => {
  const { unmount } = renderWithProviders(<RecruitList />);
  expect(panel()).not.toHaveAttribute('data-pinned');
  unmount();

  renderWithProviders(<RecruitList />, { searchParams: '?q=React' });
  expect(panel()).toHaveAttribute('data-pinned');
});

it('shows the picked value on its chip instead of the chip name', () => {
  renderWithProviders(<RecruitList />, { searchParams: '?role=FRONTEND&mode=ONLINE' });

  expect(screen.getByRole('button', { name: '프론트엔드' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '온라인' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '기술 스택' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '역할' })).not.toBeInTheDocument();
});

it('picks one tech stack as a chip and applies it on "완료" (Figma 301:1914)', async () => {
  fetchMock.mockImplementation(async (url) =>
    url === '/api/v1/public/tech-tags'
      ? [
          { id: 1, name: 'React' },
          { id: 2, name: 'Spring' },
        ]
      : { items: [], nextCursor: null },
  );
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<RecruitList />, {
    searchParams: '?overlay=recruit-filter&oid=tech',
    onUrlUpdate,
  });

  const react = await screen.findByRole('radio', { name: 'React' });
  const spring = screen.getByRole('radio', { name: 'Spring' });
  await user.click(react);
  await user.click(spring);
  // One pick at a time
  expect(react).toHaveAttribute('aria-checked', 'false');
  expect(spring).toHaveAttribute('aria-checked', 'true');

  await user.click(screen.getByRole('button', { name: '완료' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('tech=Spring') }),
    ),
  );
});

it('"초기화" clears the search, the filters and the sort', async () => {
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<RecruitList />, {
    searchParams: '?q=React&role=FRONTEND&tech=Spring&mode=ONLINE&sort=DEADLINE',
    onUrlUpdate,
  });

  await user.click(screen.getByRole('button', { name: '초기화' }));

  await waitFor(() => {
    const last = onUrlUpdate.mock.lastCall?.[0] as { queryString: string };
    for (const key of ['q=', 'role=', 'tech=', 'mode=', 'sort=']) {
      expect(last.queryString).not.toContain(key);
    }
  });
  expect(screen.getByRole('searchbox', { name: '검색어를 입력해 주세요' })).toHaveValue('');
  expect(screen.getByRole('button', { name: '역할' })).toBeInTheDocument();
});

it('shows one quiet line when "내 지원" or "내 모집 글" is empty', async () => {
  const developer = { viewer: { role: 'developer' as const, login: 'developer' } };
  const { unmount } = renderWithProviders(<RecruitList />, {
    ...developer,
    searchParams: '?tab=applied',
  });
  expect(await screen.findByText('지원한 게시물이 없습니다')).toBeVisible();
  unmount();

  renderWithProviders(<RecruitList />, { ...developer, searchParams: '?tab=mine' });
  expect(await screen.findByText('팀을 모으고 있지 않아요')).toBeVisible();
});
