'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { useDraft } from '@/features/draft-restore/use-draft';
import { ApiError } from '@/lib/api/api-error';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { type IssueStatus } from '../../../../../../_lib/issue-status';
import {
  buildFormBody,
  emptyAnswers,
  formSchema,
  type FormAnswers,
} from '../../_lib/form-body';
import { issueDraftKey, type IssueDraft } from '../../_lib/issue-draft';
import {
  createAssigneeOptions,
  createIssue,
  createLabelOptions,
  createReposOptions,
  getSyncJob,
  templateOptions,
  type ParsedTemplate,
  type SyncJob,
} from './api';

export type IssueContentStepProps = {
  teamId: string;
  repoId: number;
  templateKey: string;
  /** A restored device draft for this repo and template */
  initial: IssueDraft | null;
  onChangeTemplate: () => void;
  /** Leave for the new issue's detail without the editor left in history (blueprint §7-4) */
  onCreated: (detail: Route) => void;
};

export type FormValues = { title: string; body: string; answers: FormAnswers };
export type FormApi = UseFormReturn<FormValues, unknown, FormValues>;

const POLL_MS = 800;
const POLL_TRIES = 30;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Why the send failed, with the 04 ch. 12 copy; the content is always kept on the device first */
function sendErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'RATE_LIMITED') return '오늘은 더 할 수 없어요. 내일 다시 시도해 주세요.';
    if (error.code === 'GITHUB_UNAVAILABLE' || error.status >= 500) {
      return 'GitHub에 연결하지 못했어요. 작성한 내용은 저장해 두었어요.';
    }
    return `${error.message} 작성한 내용은 저장해 두었어요.`;
  }
  return 'GitHub에 연결하지 못했어요. 작성한 내용은 저장해 두었어요.';
}

export function useIssueContentTemplate(teamId: string, repoId: number, templateKey: string) {
  return useQuery(templateOptions(teamId, repoId, templateKey));
}

export function useIssueContentForm({
  teamId,
  repoId,
  templateKey,
  initial,
  onChangeTemplate,
  onCreated,
  template,
}: IssueContentStepProps & { template: ParsedTemplate }) {
  const id = useId();
  const draft = useDraft<IssueDraft>(issueDraftKey(teamId));
  const fields = template.kind === 'FORM' ? template.fields : [];
  const repos = useQuery(createReposOptions(teamId));
  const candidates = useQuery(createAssigneeOptions(teamId, repoId));
  const labelOptions = useQuery(createLabelOptions(teamId, repoId));
  const sheets = {
    assignees: useOverlay('issue-assignees'),
    labels: useOverlay('issue-labels'),
    schedule: useOverlay('issue-schedule'),
    status: useOverlay('issue-status'),
  };

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(
      z.object({
        title: z.string().trim().min(1, '제목을 입력해 주세요.'),
        body: z.string(),
        answers: formSchema(fields),
      }),
    ),
    defaultValues: {
      title: initial?.title ?? template.defaultTitle ?? '',
      body: initial?.body ?? (template.kind === 'MARKDOWN' ? template.body : ''),
      answers: initial?.answers ?? emptyAnswers(fields),
    },
    shouldFocusError: true,
  });
  const { errors, isDirty } = form.formState;

  // `null` = still the template's defaults (labels/assignees from the form are applied, POL-I-1)
  const [assigneeIds, setAssigneeIds] = useState<number[] | null>(initial?.assigneeIds ?? null);
  const [labels, setLabels] = useState<string[] | null>(initial?.labels ?? null);
  const [schedule, setSchedule] = useState({
    startDate: initial?.startDate ?? null,
    dueDate: initial?.dueDate ?? null,
  });
  const [status, setStatus] = useState<IssueStatus>(initial?.status ?? 'TODO');
  const [touched, setTouched] = useState(initial !== null);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'syncing'>('idle');
  const [progress, setProgress] = useState<SyncJob['steps']>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const done = useRef(false);

  const people = candidates.data?.items ?? [];
  const effectiveAssigneeIds =
    assigneeIds ??
    people.filter((user) => template.defaultAssignees.includes(user.login)).map((user) => user.id);
  const assignees = people
    .filter((user) => effectiveAssigneeIds.includes(user.id))
    .map((user) => ({ ...user, inTeam: true }));
  const labelNames = labels ?? template.defaultLabels;
  const labelObjects = labelNames.map(
    (name) => labelOptions.data?.items.find((label) => label.name === name) ?? { name, color: '' },
  );
  const repoName = repos.data?.items.find((repo) => repo.id === repoId)?.name ?? '';

  // Keep what's written on the device while typing, so leaving doesn't lose it (07 TODO 13)
  const watched = useWatch({ control: form.control });
  const snapshot = (): IssueDraft => ({
    repoId,
    templateKey,
    title: form.getValues('title'),
    body: form.getValues('body'),
    answers: form.getValues('answers'),
    assigneeIds,
    labels,
    startDate: schedule.startDate,
    dueDate: schedule.dueDate,
    status,
  });
  const latestSnapshot = useRef(snapshot);
  useEffect(() => {
    latestSnapshot.current = snapshot;
  });
  useEffect(() => {
    if (!(isDirty || touched) || done.current) return;
    const timer = window.setTimeout(() => {
      if (!done.current) draft.save(latestSnapshot.current());
    }, 600);
    return () => window.clearTimeout(timer);
  }, [watched, assigneeIds, labels, schedule, status, isDirty, touched, draft]);

  async function send(values: FormValues) {
    if (phase !== 'idle') return;
    setFailure(null);
    setPhase('sending');
    const body = template.kind === 'FORM' ? buildFormBody(fields, values.answers) : values.body;
    let created: { jobId: string; issueId: number };
    try {
      created = await createIssue(teamId, {
        repoId,
        templateKey,
        title: values.title.trim(),
        body,
        assigneeIds: effectiveAssigneeIds,
        labels: labelNames,
        startDate: schedule.startDate,
        dueDate: schedule.dueDate,
        status,
      });
    } catch (error) {
      // Never a Linker-only issue: nothing exists yet, so keep the content and say why (POL-I-1)
      draft.save(latestSnapshot.current());
      setFailure(sendErrorMessage(error));
      setPhase('idle');
      return;
    }

    // The issue exists on GitHub from here on; the draft is no longer needed
    done.current = true;
    draft.clear();
    setPhase('syncing');
    const detail = `/teams/${teamId}/issues/${created.issueId}` as Route;
    try {
      for (let tries = 0; tries < POLL_TRIES; tries += 1) {
        await sleep(POLL_MS);
        const job = await getSyncJob(teamId, created.jobId);
        setProgress(job.steps);
        if (job.status === 'FAILED') {
          toast('일정이 GitHub에 반영되지 않았어요', { tone: 'alert' });
          break;
        }
        if (job.status === 'DONE') break;
      }
    } catch {
      // The server keeps retrying; the detail page shows how it ended
    }
    toast('이슈를 만들었어요.');
    onCreated(detail);
  }

  const busy = phase !== 'idle';
  const open = (sheet: { open: () => void }) => () => {
    if (!busy) sheet.open();
  };

  return {
    id,
    fields,
    form,
    errors,
    sheets,
    assignees,
    labelNames,
    labelObjects,
    schedule,
    status,
    repoName,
    phase,
    progress,
    failure,
    busy,
    open,
    onChangeTemplate,
    send,
    setAssigneeIds,
    setLabels,
    setSchedule,
    setStatus,
    setTouched,
    assigneeCandidates: createAssigneeOptions(teamId, repoId),
    labelQueryOptions: createLabelOptions(teamId, repoId),
    template,
  };
}
