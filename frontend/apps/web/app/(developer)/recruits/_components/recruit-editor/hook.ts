'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';

import { useDraft } from '@/features/draft-restore/use-draft';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { todayKst } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { PLAN_LIMITS, RECRUIT } from '@/lib/policy';
import { useAppSignalStore } from '@/stores/app-signal-store';
import { dismissToast, toast } from '@/stores/toast-store';

import {
  createRecruit,
  editFormOptions,
  editorOptions,
  EMPTY_RECRUIT_FORM,
  recruitFormSchema,
  toRecruitRequest,
  updateRecruit,
  type EditorOptions,
  type RecruitEditForm,
  type RecruitFormValues,
} from './api';

export type RecruitEditorProps = { mode: 'create' } | { mode: 'edit'; recruitId: string };

/** Edit form values from the server → form values */
function fromEditForm(form: RecruitEditForm): RecruitFormValues {
  return {
    title: form.title,
    intro: form.intro,
    roles: form.roles.map(({ id, role, headcount }) => ({ id, role, headcount })),
    format: form.format,
    region: form.region ?? '',
    goal: form.goal ?? '',
    duration: form.duration ?? '',
    deadline: form.deadline,
    techTags: form.techTags,
    teamId: form.teamId === null ? '' : String(form.teamId),
  };
}

/** 04 ch. 2: the daily recruit-post limit has its own copy, shown instead of the shared toast */
export const DAILY_LIMIT_MESSAGE = `하루 모집글의 최대 한도는 ${RECRUIT.createPerDay}번 입니다.`;

const isDailyLimit = (error: unknown) => error instanceof ApiError && error.code === 'RATE_LIMITED';

/** Why saving failed; the content is kept on the device first */
function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) {
    return `${error.message} 작성한 내용은 저장해 두었어요.`;
  }
  return '저장하지 못했어요. 작성한 내용은 저장해 두었어요.';
}

/** Fields in on-screen order, so the toast names the first problem the user would meet */
const FIELD_ORDER = ['title', 'intro', 'teamId', 'roles', 'format', 'region', 'deadline'] as const;

/** First validation message for the error toast; role rows carry theirs per row and field */
function firstErrorMessage(errors: FieldErrors<RecruitFormValues>): string {
  for (const name of FIELD_ORDER) {
    const error = errors[name];
    if (!error) continue;
    if (name === 'roles') {
      const roles = errors.roles;
      const listMessage = roles?.message ?? roles?.root?.message;
      if (listMessage) return listMessage;
      const row = Array.isArray(roles) ? roles.find(Boolean) : undefined;
      const rowMessage = row?.role?.message ?? row?.headcount?.message;
      if (rowMessage) return rowMessage;
      continue;
    }
    if (error.message) return error.message;
  }
  return '입력한 내용을 확인해 주세요.';
}

/** Errors show as one toast at the top (not under each field); a new one replaces the last */
const ERROR_TOAST = 'recruit-editor-error';

function showError(message: string, action?: { label: string; onClick: () => void }) {
  toast(message, { tone: 'error', placement: 'top', key: ERROR_TOAST, action });
}

export function useRecruitEditor(props: RecruitEditorProps) {
  const viewer = useViewer();
  const options = useQuery(editorOptions(viewer.login));
  const editForm = useQuery({
    ...editFormOptions(viewer.login, props.mode === 'edit' ? props.recruitId : ''),
    enabled: props.mode === 'edit',
  });

  return { options, editForm };
}

type EditorFormArgs = RecruitEditorProps & {
  options: EditorOptions;
  editForm: RecruitEditForm | null;
};

export function useRecruitEditorForm({ options, editForm, ...props }: EditorFormArgs) {
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const router = useRouter();
  const client = useQueryClient();
  const creating = props.mode === 'create';
  const recruitId = props.mode === 'edit' ? props.recruitId : null;
  const draft = useDraft<RecruitFormValues>(
    creating ? 'draft:recruit:new' : `draft:recruit:${recruitId}`,
  );
  const restoreSheet = useOverlay('draft-restore');
  const tagSheet = useOverlay('tech-tags');
  const deadlineSheet = useOverlay('recruit-deadline');
  const [today] = useState(() => todayKst());
  const atLimit = creating && options.openCount >= options.openLimit;
  const done = useRef(false);

  const form = useForm<RecruitFormValues, unknown, RecruitFormValues>({
    resolver: zodResolver(
      recruitFormSchema({
        today,
        maxDeadline: options.maxDeadlineDate,
        minHeadcountByRole: editForm?.minHeadcountByRole,
      }),
    ),
    defaultValues: editForm ? fromEditForm(editForm) : EMPTY_RECRUIT_FORM,
    shouldFocusError: true,
  });
  const { errors, isDirty } = form.formState;
  const watched = useWatch({ control: form.control });
  const format = watched.format ?? 'ONLINE';
  const techTags = (watched.techTags ?? []).filter((tag): tag is string => Boolean(tag));

  // On open: at the open-post cap the limit sheet comes first; otherwise offer the saved draft
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (atLimit) {
      const proLimit = PLAN_LIMITS.openRecruitPosts.pro;
      useAppSignalStore.setState({
        planLimit: {
          reason: 'RECRUIT_POSTS',
          message:
            options.openLimit < proLimit
              ? `동시에 모집할 수 있는 글은 ${options.openLimit}개까지예요. Pro로 ${proLimit}개까지 늘릴 수 있어요.`
              : `동시에 모집할 수 있는 글은 ${options.openLimit}개까지예요. 모집 중인 글을 마감하면 새로 쓸 수 있어요.`,
        },
      });
    } else if (draft.load()) restoreSheet.open();
  }, [atLimit, draft, options.openLimit, restoreSheet]);

  // Keep what's written on the device while typing, so leaving doesn't lose it (07 TODO 20)
  useEffect(() => {
    if (!isDirty || done.current) return;
    const timer = window.setTimeout(() => {
      if (!done.current) draft.save(form.getValues());
    }, 600);
    return () => window.clearTimeout(timer);
  }, [watched, isDirty, draft, form]);

  const save = useMutation({
    mutationFn: (values: RecruitFormValues) =>
      recruitId === null
        ? createRecruit(toRecruitRequest(values))
        : updateRecruit(recruitId, toRecruitRequest(values)),
    // Only creating counts toward the daily limit; its toast below replaces the shared one
    meta: creating ? { handledCodes: ['RATE_LIMITED'] } : undefined,
    onMutate: () => dismissToast(ERROR_TOAST),
    onSuccess: async ({ id: savedId }) => {
      done.current = true;
      draft.clear();
      toast(creating ? '모집 글을 올렸어요.' : '모집 글을 수정했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
      // Done writing: back must not reopen the editor (blueprint §7-4)
      router.replace(`/recruits/${savedId}` as Route);
    },
    onError: (error) => {
      draft.save(form.getValues());
      // PLAN_LIMIT already opened the shared limit sheet
      if (error instanceof ApiError && error.code === 'PLAN_LIMIT') return;
      // Resending today would hit the same limit, so no "다시 보내기"
      if (creating && isDailyLimit(error)) {
        showError(DAILY_LIMIT_MESSAGE);
        return;
      }
      showError(saveErrorMessage(error), { label: '다시 보내기', onClick: () => void submit() });
    },
  });

  const submit = form.handleSubmit(
    (values) => {
      if (!save.isPending) save.mutate(values);
    },
    (invalid) => showError(firstErrorMessage(invalid)),
  );

  function removeTechTag(tag: string) {
    form.setValue(
      'techTags',
      techTags.filter((name) => name !== tag),
      { shouldDirty: true },
    );
  }

  function saveTechTags(names: string[]) {
    form.setValue('techTags', names, { shouldDirty: true });
  }

  function restoreDraft() {
    const value = draft.load();
    if (value) form.reset(value, { keepDefaultValues: true });
  }

  function discardDraft() {
    draft.clear();
  }

  function markDeleted() {
    done.current = true;
    draft.clear();
  }

  return {
    field,
    creating,
    recruitId,
    atLimit,
    form,
    errors,
    watched,
    format,
    techTags,
    today,
    tagSheet,
    deadlineSheet,
    save,
    submit,
    removeTechTag,
    saveTechTags,
    restoreDraft,
    discardDraft,
    markDeleted,
    editForm,
    options,
  };
}
