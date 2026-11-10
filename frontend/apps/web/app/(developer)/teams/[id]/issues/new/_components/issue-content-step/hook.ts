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
  emptyAnswers,
  formSchema,
  toApiAnswers,
  type FormAnswers,
} from '../../_lib/form-body';
import { issueDraftKey, type IssueDraft } from '../../_lib/issue-draft';
import {
  createAssigneeOptions,
  createIssue,
  createLabelOptions,
  getSyncJob,
  templateOptions,
  type CreateProgress,
  type ParsedTemplate,
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

function newRequestId() {
  return crypto.randomUUID();
}

function payloadFingerprint(parts: {
  repoId: number;
  templateKey: string;
  title: string;
  body: string;
  answers: Record<string, string[]>;
  assigneeIds: number[];
  labels: string[];
  startDate: string | null;
  dueDate: string | null;
  status: IssueStatus;
}) {
  return JSON.stringify(parts);
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
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const done = useRef(false);
  const requestIdRef = useRef(initial?.requestId ?? newRequestId());
  const lastFingerprintRef = useRef<string | null>(null);

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
    requestId: requestIdRef.current,
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
    setProgressStep(null);

    const answers =
      template.kind === 'FORM' ? toApiAnswers(fields, values.answers) : {};
    const body = template.kind === 'MARKDOWN' ? values.body.slice(0, ISSUE.bodyMax) : undefined;
    const fingerprint = payloadFingerprint({
      repoId,
      templateKey: effectiveTemplateKey,
      title: values.title.trim(),
      body: body ?? '',
      answers,
      assigneeIds: effectiveAssigneeIds,
      labels: labelNames,
      startDate: schedule.startDate,
      dueDate: schedule.dueDate,
      status,
    });
    if (lastFingerprintRef.current !== null && lastFingerprintRef.current !== fingerprint) {
      requestIdRef.current = newRequestId();
    }

    let created: CreateProgress;
    try {
      created = await createIssue(teamId, {
        requestId: requestIdRef.current,
        repoId,
        templateKey: effectiveTemplateKey,
        title: values.title.trim(),
        ...(body !== undefined ? { body } : {}),
        answers,
        assigneeIds: effectiveAssigneeIds,
        labels: labelNames,
        ...(schedule.startDate ? { startDate: schedule.startDate } : {}),
        ...(schedule.dueDate ? { dueDate: schedule.dueDate } : {}),
        status,
      });
      lastFingerprintRef.current = fingerprint;
    } catch (error) {
      draft.save(latestSnapshot.current());
      setFailure(sendErrorMessage(error));
      setPhase('idle');
      return;
    }

    const jobId = created.jobId;
    if (jobId == null) {
      draft.save(latestSnapshot.current());
      setFailure('이슈를 만들지 못했어요. 작성한 내용은 저장해 두었어요.');
      setPhase('idle');
      return;
    }

    setPhase('syncing');
    if (created.step) setProgressStep(created.step);

    let job = created;
    try {
      for (let tries = 0; tries < POLL_TRIES; tries += 1) {
        if (job.status === 'DONE' || job.status === 'FAILED') break;
        await sleep(POLL_MS);
        job = await getSyncJob(teamId, jobId);
        if (job.step) setProgressStep(job.step);
      }
    } catch {
      draft.save(latestSnapshot.current());
      setFailure('진행 상태를 확인하지 못했어요. 작성한 내용은 저장해 두었어요.');
      setPhase('idle');
      return;
    }

    if (job.status === 'FAILED') {
      draft.save(latestSnapshot.current());
      setFailure(
        job.errorCode
          ? `${job.errorCode} 작성한 내용은 저장해 두었어요.`
          : '이슈를 만들지 못했어요. 작성한 내용은 저장해 두었어요.',
      );
      setPhase('idle');
      return;
    }

    if (job.status === 'DONE' && job.issueId != null) {
      done.current = true;
      draft.clear();
      toast('이슈를 만들었어요.');
      const detail = (job.detailPath ??
        `/teams/${teamId}/issues/${job.issueId}`) as Route;
      onCreated(detail);
      return;
    }

    draft.save(latestSnapshot.current());
    setFailure('이슈를 만들지 못했어요. 작성한 내용은 저장해 두었어요.');
    setPhase('idle');
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
    progressStep,
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
