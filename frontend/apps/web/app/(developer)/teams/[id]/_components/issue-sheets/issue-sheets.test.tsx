import { queryOptions } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { ApiError } from '@/lib/api/api-error';
import { todayKst } from '@/lib/format/time';
import { renderWithProviders } from '@/test/render-with-providers';

import type { AssigneeCandidates } from '../../_lib/issue-detail-queries';

import { IssueAssigneeSheet } from './issue-assignee-sheet/IssueAssigneeSheet';
import { IssueLabelSheet } from './issue-label-sheet/IssueLabelSheet';
import { IssueScheduleSheet } from './issue-schedule-sheet/IssueScheduleSheet';
import { IssueStatusSheet } from './issue-status-sheet/IssueStatusSheet';

const user = (id: number, name: string, inTeam = true) => ({
  id,
  login: `user-${id}`,
  name,
  avatarUrl: `https://avatars.githubusercontent.com/u/${id}`,
  inTeam,
});

const candidates = (
  items: Array<ReturnType<typeof user> & { jobRole?: string }>,
  max = 10,
) =>
  queryOptions({
    queryKey: ['test', 'candidates', max],
    // Candidates are plain users (no `inTeam`), like the API
    queryFn: async (): Promise<AssigneeCandidates> => ({
      items: items.map(({ id, login, name, avatarUrl, jobRole }) => ({
        id,
        login,
        name,
        avatarUrl,
        ...(jobRole ? { jobRole } : {}),
      })),
      max,
    }),
  });

describe('IssueStatusSheet', () => {
  it('saves the picked status, accessibly', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { baseElement } = renderWithProviders(<IssueStatusSheet value="TODO" onSave={onSave} />, {
      searchParams: '?overlay=issue-status',
    });
    expect(document.querySelector('[class*="radioMark"]')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: /작업 완료/ }));
    await userEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(onSave).toHaveBeenCalledWith('DONE');
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it('keeps the sheet open with the reason when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(
      new ApiError(403, {
        code: 'GITHUB_PERMISSION',
        message: '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.',
      }),
    );
    renderWithProviders(<IssueStatusSheet value="TODO" onSave={onSave} />, {
      searchParams: '?overlay=issue-status',
    });
    await userEvent.click(screen.getByRole('radio', { name: /작업 중단/ }));
    await userEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이 레포에 쓸 권한이 없어요');
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});

describe('IssueScheduleSheet', () => {
  async function pick(year: string, month: string, day: string) {
    await userEvent.click(screen.getByRole('option', { name: year }));
    await userEvent.click(screen.getByRole('option', { name: month }));
    await userEvent.click(screen.getByRole('option', { name: day }));
  }

  it('rejects a due date before the start date and focuses it (POL-I-3)', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <IssueScheduleSheet
        part="due"
        value={{ startDate: '2099-05-10', dueDate: null }}
        onSave={onSave}
      />,
      { searchParams: '?overlay=issue-schedule' },
    );
    await pick('2099년', '5월', '1일');
    const due = screen.getByRole('listbox', { name: '마감일' });
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(due).toHaveAttribute('aria-invalid', 'true');
    expect(due).toHaveAccessibleDescription('마감일은 시작일과 같거나 그 뒤여야 해요.');
    expect(due).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('asks once for a past due date, then saves on the second press', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <IssueScheduleSheet part="due" value={{ startDate: null, dueDate: null }} onSave={onSave} />,
      { searchParams: '?overlay=issue-schedule' },
    );
    await pick('2001년', '1월', '5일');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByRole('alert')).toHaveTextContent('이미 지난 날짜예요');
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '지난 날짜로 저장' }));
    expect(onSave).toHaveBeenCalledWith({ startDate: null, dueDate: '2001-01-05' });
  });

  it('saves the wheel-visible today for start and due when opened empty', async () => {
    const today = todayKst();
    const onStart = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <IssueScheduleSheet part="start" value={{ startDate: null, dueDate: null }} onSave={onStart} />,
      { searchParams: '?overlay=issue-schedule' },
    );
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onStart).toHaveBeenCalledWith({ startDate: today, dueDate: null });

    const onDue = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <IssueScheduleSheet part="due" value={{ startDate: null, dueDate: null }} onSave={onDue} />,
      { searchParams: '?overlay=issue-schedule' },
    );
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onDue).toHaveBeenCalledWith({ startDate: null, dueDate: today });
  });

  it('does not ask again when the past due date was already saved', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const past = '2001-01-05';
    expect(past < todayKst()).toBe(true);
    renderWithProviders(
      <IssueScheduleSheet
        part="start"
        value={{ startDate: null, dueDate: past }}
        onSave={onSave}
      />,
      { searchParams: '?overlay=issue-schedule' },
    );
    await pick('2000년', '12월', '1일');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledWith({ startDate: '2000-12-01', dueDate: past });
  });
});

describe('IssueAssigneeSheet', () => {
  it('shows optional jobRole next to the name (Figma 368:2309) without a left radio', async () => {
    renderWithProviders(
      <IssueAssigneeSheet
        value={[]}
        candidates={candidates([{ ...user(1, '한서준'), jobRole: 'PO' }])}
        onSave={vi.fn()}
      />,
      { searchParams: '?overlay=issue-assignees' },
    );
    expect(await screen.findByRole('checkbox', { name: /한서준/ })).toBeInTheDocument();
    expect(screen.getByText('PO')).toBeVisible();
    expect(document.querySelector('[class*="radioMark"]')).toBeNull();
  });

  it('keeps current assignees who are not candidates, so saving never drops them', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <IssueAssigneeSheet
        value={[user(2, '정하윤'), user(6, '강지우', false)]}
        candidates={candidates([user(1, '한서준')])}
        onSave={onSave}
      />,
      { searchParams: '?overlay=issue-assignees' },
    );
    expect(
      await screen.findByRole('checkbox', { name: /정하윤.*GitHub 조직 초대 수락 전/ }),
    ).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /강지우.*팀 밖 사용자/ })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: /한서준/ }));
    await userEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(onSave).toHaveBeenCalledWith([2, 6, 1]);
  });

  it('stops at the maximum (POL-I-2)', async () => {
    renderWithProviders(
      <IssueAssigneeSheet
        value={[user(1, '한서준')]}
        candidates={candidates([user(1, '한서준'), user(2, '이도윤')], 1)}
        onSave={vi.fn()}
      />,
      { searchParams: '?overlay=issue-assignees' },
    );
    expect(await screen.findByRole('checkbox', { name: /이도윤/ })).toBeDisabled();
    expect(screen.getByText(/1\/1명 선택/)).toBeInTheDocument();
  });
});

describe('IssueLabelSheet', () => {
  it('saves the checked label names', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <IssueLabelSheet
        value={[{ name: 'bug', color: 'd73a4a' }]}
        options={queryOptions({
          queryKey: ['test', 'labels'],
          queryFn: async () => ({
            items: [
              { name: 'bug', color: 'd73a4a' },
              { name: 'docs', color: '0075ca' },
            ],
          }),
        })}
        onSave={onSave}
      />,
      { searchParams: '?overlay=issue-labels' },
    );
    await userEvent.click(await screen.findByRole('checkbox', { name: 'docs' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'bug' }));
    await userEvent.click(screen.getByRole('button', { name: '완료' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['docs']));
  });
});
