import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomInfo } from '../_lib/room-api';
import { ChatComposer } from './chat-composer';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const room: RoomInfo = { id: 1, kind: 'TEAM', title: '팀', requestDirection: null, muted: false, members: [], team: { id: 1, name: '팀', plan: 'FLEX', myRole: 'MEMBER', status: 'ACTIVE' }, historyLimitDays: null };
beforeEach(() => {
  resetOverlayHistory();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (path) => {
    if (path.endsWith('/mention-candidates')) return { items: [{ id: 2, login: 'doyun', name: '도윤', avatarUrl: '' }] };
    if (path.endsWith('/issue-filters')) return { repos: [{ id: 11, name: 'linker-web' }] };
    if (path.includes('/issue-cards?number=15&repoId=11')) return { canView: true, issueId: 1015, teamId: 1, repoId: 11, number: 15, repoName: 'linker-web', title: '피드 카드', status: 'IN_PROGRESS' };
    throw new Error('not found');
  });
});
it('selects a teammate from autocomplete and sends their ID while preserving input text', async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<ChatComposer room={room} login="me" disabled={false} onSend={send} />);
  await user.type(screen.getByRole('textbox', { name: '메시지' }), '안녕 @도');
  await user.click(await screen.findByRole('button', { name: '도윤 (@doyun)' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: '메시지' })).toHaveValue('안녕 @doyun '));
  await user.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenCalledWith({ text: '안녕 @doyun', images: [], references: { mentionedUserIds: [2], mentionAll: false, issueRefs: [] } });
});
it('blocks a manually typed all-mention for members, and allows it for an owner', async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  const { unmount } = renderWithProviders(<ChatComposer room={room} login="me" disabled={false} onSend={send} />);
  await user.type(screen.getByRole('textbox', { name: '메시지' }), '@all ');
  expect(await screen.findByText('@전체는 팀 오너와 관리자만 사용할 수 있어요.')).toBeVisible();
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  unmount();
  renderWithProviders(<ChatComposer room={{ ...room, team: { ...room.team!, myRole: 'OWNER' } }} login="me" disabled={false} onSend={send} />);
  await user.type(screen.getByRole('textbox', { name: '메시지' }), '@all ');
  await waitFor(() => expect(screen.getByRole('button', { name: '보내기' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ references: expect.objectContaining({ mentionAll: true }) }));
});
it('resolves an issue in the only linked repo before enabling send', async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<ChatComposer room={room} login="me" disabled={false} onSend={send} />);
  await user.type(screen.getByRole('textbox', { name: '메시지' }), '#15 ');
  expect(await screen.findByText('linker-web #15 · 피드 카드')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ references: { mentionedUserIds: [], mentionAll: false, issueRefs: [{ number: 15, repoId: 11 }] } }));
});
it('requires a repo choice rather than silently selecting the first of multiple repos', async () => {
  fetchMock.mockImplementation(async (path) => {
    if (path.endsWith('/issue-filters')) return { repos: [{ id: 11, name: 'web' }, { id: 12, name: 'api' }] };
    return { canView: true, issueId: 1015, teamId: 1, repoId: 12, number: 15, repoName: 'api', title: 'API 이슈', status: 'TODO' };
  });
  const user = userEvent.setup();
  renderWithProviders(<ChatComposer room={room} login="me" disabled={false} onSend={vi.fn()} />);
  await user.type(screen.getByRole('textbox', { name: '메시지' }), '#15 ');
  await user.click(await screen.findByRole('button', { name: '#15 저장소 선택' }));
  expect(fetchMock.mock.calls.some(([path]) => path.includes('/issue-cards?'))).toBe(false);
  // The testing adapter does not emulate browser back; exercise the URL-entered close path.
  act(() => resetOverlayHistory());
  await user.click(screen.getByRole('button', { name: 'api' }));
  expect(await screen.findByText('api #15 · API 이슈')).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-rooms/1/issue-cards?number=15&repoId=12', expect.anything());
});
