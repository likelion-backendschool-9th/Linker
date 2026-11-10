'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { useDraft } from '@/features/draft-restore/use-draft';
import { ApiError } from '@/lib/api/api-error';
import { ISSUE } from '@/lib/policy';
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
  getSyncJob,
  templateOptions,
  type ParsedTemplate,
  type SyncJob,
} from './api';

export type IssueContentStepProps = {
  teamId: string;
  repoId: number | null;
  templateKey: string | null;
  repoLabel: string | null;
  templateLabel: string | null;
  onOpenRepo: () => void;
  onOpenTemplate: () => void;
  initial: IssueDraft | null;
  onCreated: (detail: Route) => void;
};

export type FormValues = { title: string; body: string; answers: FormAnswers };
export type FormApi = UseFormReturn<FormValues, unknown, FormValues>;

const POLL_MS = 800;
const POLL_TRIES = 30;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Empty markdown shell when no template is picked yet (Figma: template optional). */
export const EMPTY_TEMPLATE: ParsedTemplate = {
  key: 'default:task',
  source: 'DEFAULT',
  name: '작업',
  description: '',
  kind: 'MARKDOWN',
  body: '',
  defaultTitle: '',
  defaultLabels: [],
  defaultAssignees: [],
  fallback: false,
};

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

export function useIssueContentTemplate(
  teamId: string,
  repoId: number | null,
  templateKey: string | null,
) {
  return useQuery({
    ...templateOptions(teamId, repoId ?? 0, templateKey ?? ''),
    enabled: repoId !== null && Boolean(templateKey),
  });
}

export function useIssueContentForm({
  teamId,
  repoId,
  templateKey,
  initial,
  onCreated,
  template,
}: IssueContentStepProps & { template: ParsedTemplate }) {
  const id = useId();
  const draft = useDraft<IssueDraft>(issueDraftKey(teamId));
  const fields = template.kind === 'FORM' ? template.fields : [];
  const effectiveRepoId = repoId ?? 0;
  const effectiveTemplateKey = templateKey ?? EMPTY_TEMPLATE.key;
  const candidates = useQuery({
    ...createAssigneeOptions(teamId, effectiveRepoId),
    enabled: repoId !== null,
  });
  const labelOptions = useQuery({
    ...createLabelOptions(teamId, effectiveRepoId),
    enabled: repoId !== null,
  });
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
        body: z.string().max(ISSUE.bodyMax),
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

  const watched = useWatch({ control: form.control });
  const snapshot = (): IssueDraft => ({
    repoId: effectiveRepoId,
    templateKey: effectiveTemplateKey,
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
    if (!(isDirty || touched) || done.current || repoId === null) return;
    const timer = window.setTimeout(() => {
      if (!done.current) draft.save(latestSnapshot.current());
    }, 600);
    return () => window.clearTimeout(timer);
  }, [watched, assigneeIds, labels, schedule, status, isDirty, touched, draft, repoId]);

  async function send(values: FormValues) {
    if (phase !== 'idle' || repoId === null) return;
    setFailure(null);
    setPhase('sending');
    const body =
      template.kind === 'FORM' ? buildFormBody(fields, values.answers) : values.body.slice(0, ISSUE.bodyMax);
    let created: { jobId: string; issueId: number };
    try {
      created = await createIssue(teamId, {
        repoId,
        templateKey: effectiveTemplateKey,
        title: values.title.trim(),
        body,
        assigneeIds: effectiveAssigneeIds,
        labels: labelNames,
        startDate: schedule.startDate,
        dueDate: schedule.dueDate,
        status,
      });
    } catch (error) {
      draft.save(latestSnapshot.current());
      setFailure(sendErrorMessage(error));
      setPhase('idle');
      return;
    }

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
          toast('일정이 GitHub에 반영되지 않았어요', { tone: 'error' });
          break;
        }
        if (job.status === 'DONE') break;
      }
    } catch {
      // detail page shows how it ended
    }
    toast('이슈를 만들었어요.');
    onCreated(detail);
  }

  const busy = phase !== 'idle';
  const open = (sheet: { open: () => void }) => () => {
    if (!busy && repoId !== null) sheet.open();
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
    phase,
    progress,
    failure,
    busy,
    open,
    send,
    setAssigneeIds,
    setLabels,
    setSchedule,
    setStatus,
    setTouched,
    assigneeCandidates: createAssigneeOptions(teamId, effectiveRepoId),
    labelQueryOptions: createLabelOptions(teamId, effectiveRepoId),
    template,
    bodyMax: ISSUE.bodyMax,
  };
}
