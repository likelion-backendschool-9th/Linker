'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { useDraft } from '@/features/draft-restore/use-draft';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { todayKst } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { PLAN_LIMITS } from '@/lib/policy';
import { useAppSignalStore } from '@/stores/app-signal-store';
import { toast } from '@/stores/toast-store';

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

/** Why saving failed, with the 04 ch. 12 copy; the content is kept on the device first */
function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
    return '오늘은 더 할 수 없어요. 내일 다시 시도해 주세요.';
  }
  if (error instanceof ApiError && error.status < 500) {
    return `${error.message} 작성한 내용은 저장해 두었어요.`;
  }
  return '저장하지 못했어요. 작성한 내용은 저장해 두었어요.';
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
  const [today] = useState(() => todayKst());
  const atLimit = creating && options.openCount >= options.openLimit;
  const [failure, setFailure] = useState<string | null>(null);
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
    onMutate: () => setFailure(null),
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
      if (!(error instanceof ApiError && error.code === 'PLAN_LIMIT')) {
        setFailure(saveErrorMessage(error));
      }
    },
  });

  const submit = form.handleSubmit((values) => {
    if (!save.isPending) save.mutate(values);
  });
  const errorId = (name: string) => `${field(name)}-error`;
  const describe = (...ids: (string | false | undefined)[]) =>
    ids.filter(Boolean).join(' ') || undefined;

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
    errorId,
    describe,
    creating,
    recruitId,
    atLimit,
    failure,
    form,
    errors,
    watched,
    format,
    techTags,
    today,
    tagSheet,
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
