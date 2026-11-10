'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  assigneeCandidatesOptions,
  issueDetailKeys,
  issueDetailOptions,
  labelOptionsOptions,
  saveAssignees,
  saveLabels,
  saveSchedule,
  saveStatus,
  subIssuesOptions,
  type IssueDetail,
  issueKeys,
} from './api';

/** 04 ch. 12 "No GitHub permission" */
const NO_PERMISSION = '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.';

export function useIssueDetailView(teamId: string, issueId: string) {
  const viewer = useViewer();
  const client = useQueryClient();
  const detail = useQuery(issueDetailOptions(teamId, issueId));
  const openExternal = useOpenExternal();
  const sheets = {
    assignees: useOverlay('issue-assignees'),
    labels: useOverlay('issue-labels'),
    schedule: useOverlay('issue-schedule'),
    status: useOverlay('issue-status'),
  };

  const issue = detail.data;
  const subIssues = useQuery({
    ...subIssuesOptions(teamId, issueId),
    enabled: Boolean(issue && issue.subIssues.total > 0),
  });
  const canWrite = Boolean(issue?.canWrite && viewer.status !== 'SUSPENDED');

  /** After a save: show the saved value now, then refetch the detail and every list of this team */
  async function applied(patch: Partial<IssueDetail>) {
    client.setQueryData<IssueDetail>(issueDetailKeys.detail(teamId, issueId), (old) =>
      old ? { ...old, ...patch } : old,
    );
    await client.invalidateQueries({ queryKey: issueKeys.team(teamId) });
  }

  /** Without repo write permission the button stays focusable and says why (POL-I-2, 04 ch. 7) */
  function edit(open: () => void) {
    return () => {
      if (!canWrite) {
        toast(
          viewer.status === 'SUSPENDED' ? '이용이 제한된 동안에는 바꿀 수 없어요.' : NO_PERMISSION,
          { tone: 'error' },
        );
        return;
      }
      open();
    };
  }

  return {
    issue,
    canWrite,
    openExternal,
    sheets,
    edit,
    subIssues,
    saveStatus: async (status: Parameters<typeof saveStatus>[2]) => {
      const saved = await saveStatus(teamId, issueId, status);
      await applied(saved);
      toast('상태를 바꿨어요.');
    },
    saveAssignees: async (userIds: number[]) => {
      const saved = await saveAssignees(teamId, issueId, userIds);
      await applied(saved);
      toast('담당자를 바꿨어요.');
    },
    saveLabels: async (labels: string[]) => {
      const saved = await saveLabels(teamId, issueId, labels);
      await applied(saved);
      toast('라벨을 바꿨어요.');
    },
    saveSchedule: async (schedule: Parameters<typeof saveSchedule>[2]) => {
      const saved = await saveSchedule(teamId, issueId, schedule);
      await applied(saved);
      toast('일정을 바꿨어요.');
    },
    assigneeCandidates: assigneeCandidatesOptions(teamId, issueId),
    labelOptions: labelOptionsOptions(teamId, issueId),
  };
}
