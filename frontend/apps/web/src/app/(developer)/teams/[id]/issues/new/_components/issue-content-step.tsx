'use client';

// Own region: step 2, title + body (Markdown or issue form), assignees/labels/dates/status, send
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch, type Path, type UseFormReturn } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { useDraft } from '@/features/draft-restore/use-draft';
import { ApiError } from '@/lib/api/api-error';
import { formatDate } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { IssueAssigneeSheet } from '../../../_components/issue-sheets/issue-assignee-sheet';
import { IssueLabelSheet } from '../../../_components/issue-sheets/issue-label-sheet';
import { IssueScheduleSheet } from '../../../_components/issue-sheets/issue-schedule-sheet';
import { IssueStatusSheet } from '../../../_components/issue-sheets/issue-status-sheet';
import { ISSUE_STATUS_LABELS, type IssueStatus } from '../../../../../_lib/issue-status';
import {
  createAssigneeOptions,
  createIssue,
  createLabelOptions,
  createReposOptions,
  getSyncJob,
  templateOptions,
  type FormField,
  type ParsedTemplate,
  type SyncJob,
} from '../_lib/create-queries';
import {
  buildFormBody,
  emptyAnswers,
  formSchema,
  isInputField,
  type FormAnswers,
} from '../_lib/form-body';
import { issueDraftKey, type IssueDraft } from '../_lib/issue-draft';
import styles from './issue-create.module.css';

type IssueContentStepProps = {
  teamId: string;
  repoId: number;
  templateKey: string;
  /** A restored device draft for this repo and template */
  initial: IssueDraft | null;
  onChangeTemplate: () => void;
  /** Leave for the new issue's detail without the editor left in history (blueprint §7-4) */
  onCreated: (detail: Route) => void;
};

export function IssueContentStep(props: IssueContentStepProps) {
  const { teamId, repoId, templateKey } = props;
  const template = useQuery(templateOptions(teamId, repoId, templateKey));
  if (template.isPending) {
    return (
      <LoadingIndicator label="템플릿을 불러오고 있어요." variant="block">
        <Skeleton count={2} />
      </LoadingIndicator>
    );
  }
  if (template.isError) {
    return (
      <ErrorState title="템플릿을 불러오지 못했어요" onRetry={() => void template.refetch()} />
    );
  }
  return <ContentForm {...props} template={template.data} />;
}

type FormValues = { title: string; body: string; answers: FormAnswers };

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

function ContentForm({
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

  return (
    <>
      <div className={styles.chosen}>
        <p className={styles.chosenText}>
          {repoName} · {template.name}
        </p>
        <Button variant="soft" aria-disabled={busy} onClick={() => !busy && onChangeTemplate()}>
          다시 고르기
        </Button>
      </div>
      {template.fallback && (
        <p className={styles.notice} role="status">
          레포 템플릿을 읽지 못해 기본 템플릿으로 바꿨어요.
        </p>
      )}

      <form
        className={styles.form}
        noValidate
        aria-busy={busy}
        onSubmit={(event) => void form.handleSubmit(send)(event)}
      >
        <div className={styles.field}>
          <label htmlFor={`${id}-title`} className={styles.label}>
            제목 <span aria-hidden>*</span>
            <span className="sr-only">(필수)</span>
          </label>
          <input
            id={`${id}-title`}
            className={styles.input}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${id}-title-error` : undefined}
            {...form.register('title')}
          />
          {errors.title && (
            <p id={`${id}-title-error`} className={styles.error}>
              {errors.title.message}
            </p>
          )}
        </div>

        {template.kind === 'MARKDOWN' ? (
          <div className={styles.field}>
            <label htmlFor={`${id}-body`} className={styles.label}>
              내용
            </label>
            <textarea
              id={`${id}-body`}
              className={styles.textarea}
              rows={10}
              aria-describedby={`${id}-body-hint`}
              {...form.register('body')}
            />
            <p id={`${id}-body-hint`} className={styles.hint}>
              마크다운을 쓸 수 있어요. 첨부는 GitHub에서 할 수 있어요.
            </p>
          </div>
        ) : (
          fields.map((field) => (
            <FormFieldInput key={field.id} field={field} form={form} idPrefix={id} />
          ))
        )}

        <section aria-labelledby={`${id}-props`} className={styles.props}>
          <h2 id={`${id}-props`} className={styles.propsTitle}>
            이슈 설정
          </h2>
          <dl className={styles.fields}>
            <div className={styles.row}>
              <dt className={styles.term}>담당자</dt>
              <dd className={styles.value}>
                {assignees.length === 0 ? '없음' : assignees.map((user) => user.name).join(', ')}
              </dd>
              <dd className={styles.action}>
                <Button variant="outline" aria-disabled={busy} onClick={open(sheets.assignees)}>
                  담당자 변경
                </Button>
              </dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.term}>라벨</dt>
              <dd className={styles.value}>
                {labelNames.length === 0 ? '없음' : labelNames.join(', ')}
              </dd>
              <dd className={styles.action}>
                <Button variant="outline" aria-disabled={busy} onClick={open(sheets.labels)}>
                  라벨 변경
                </Button>
              </dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.term}>기간</dt>
              <dd className={styles.value}>
                {!schedule.startDate && !schedule.dueDate ? (
                  '일정 없음'
                ) : (
                  <>
                    {schedule.startDate ? (
                      <time dateTime={schedule.startDate}>{formatDate(schedule.startDate)}</time>
                    ) : (
                      '시작일 없음'
                    )}
                    {' ~ '}
                    {schedule.dueDate ? (
                      <time dateTime={schedule.dueDate}>{formatDate(schedule.dueDate)}</time>
                    ) : (
                      '마감일 없음'
                    )}
                  </>
                )}
              </dd>
              <dd className={styles.action}>
                <Button variant="outline" aria-disabled={busy} onClick={open(sheets.schedule)}>
                  일정 변경
                </Button>
              </dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.term}>상태</dt>
              <dd className={styles.value}>{ISSUE_STATUS_LABELS[status]}</dd>
              <dd className={styles.action}>
                <Button variant="outline" aria-disabled={busy} onClick={open(sheets.status)}>
                  상태 바꾸기
                </Button>
              </dd>
            </div>
          </dl>
        </section>

        {failure && (
          <div className={styles.failure} role="alert">
            <p>{failure}</p>
            <Button variant="outline" onClick={() => void form.handleSubmit(send)()}>
              다시 보내기
            </Button>
          </div>
        )}

        {phase === 'syncing' && (
          <div role="status" className={styles.progress}>
            <p className={styles.progressTitle}>GitHub에 반영하고 있어요</p>
            <ol className={styles.progressSteps}>
              {progress.map((item) => (
                <li key={item.name} data-done={item.done}>
                  {item.name} {item.done ? '완료' : '진행 중'}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className={styles.actions}>
          <Button type="submit" aria-disabled={busy}>
            {phase === 'sending'
              ? '만드는 중…'
              : phase === 'syncing'
                ? '반영하는 중…'
                : '이슈 만들기'}
          </Button>
        </div>
      </form>

      <IssueAssigneeSheet
        value={assignees}
        candidates={createAssigneeOptions(teamId, repoId)}
        onSave={async (ids) => {
          setAssigneeIds(ids);
          setTouched(true);
        }}
      />
      <IssueLabelSheet
        value={labelObjects}
        options={createLabelOptions(teamId, repoId)}
        onSave={async (names) => {
          setLabels(names);
          setTouched(true);
        }}
      />
      <IssueScheduleSheet
        value={schedule}
        onSave={async (value) => {
          setSchedule(value);
          setTouched(true);
        }}
      />
      <IssueStatusSheet
        value={status}
        onSave={async (value) => {
          setStatus(value);
          setTouched(true);
        }}
      />
    </>
  );
}

type FormApi = UseFormReturn<FormValues, unknown, FormValues>;

/** One issue form (YAML) item as a mobile input (POL-I-1, 04 ch. 7 exceptions) */
function FormFieldInput({
  field,
  form,
  idPrefix,
}: {
  field: FormField;
  form: FormApi;
  idPrefix: string;
}) {
  const inputId = `${idPrefix}-f-${field.id}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  // A checkbox group's own error sits under `root` (react-hook-form field arrays)
  type FieldError = { message?: string; root?: { message?: string } };
  const fieldError = (form.formState.errors.answers as Record<string, FieldError> | undefined)?.[
    field.id
  ];
  const error = fieldError?.message ?? fieldError?.root?.message;
  const path = `answers.${field.id}` as Path<FormValues>;

  if (field.type === 'markdown' && 'value' in field) {
    return (
      <div className={styles.help}>
        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{field.value}</ReactMarkdown>
      </div>
    );
  }
  if (field.type === 'upload') {
    return (
      <p className={styles.notice}>
        {'label' in field && field.label ? `${field.label}: ` : ''}첨부는 GitHub에서 할 수 있어요.
      </p>
    );
  }
  if (!isInputField(field)) {
    return (
      <p className={styles.hint}>
        &quot;{('label' in field && field.label) || field.id}&quot; 항목은 앱에서 입력할 수 없어
        제목만 본문에 들어가요.
      </p>
    );
  }

  const describedBy =
    [field.description ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;
  const required = 'required' in field && field.required;
  const label = (
    <>
      {field.label}
      {required && (
        <>
          {' '}
          <span aria-hidden>*</span>
          <span className="sr-only">(필수)</span>
        </>
      )}
    </>
  );
  const hint = field.description && (
    <p id={hintId} className={styles.hint}>
      {field.description}
    </p>
  );
  const errorText = error && (
    <p id={errorId} className={styles.error}>
      {error}
    </p>
  );

  if (field.type === 'checkboxes' || (field.type === 'dropdown' && field.multiple)) {
    const options =
      field.type === 'checkboxes'
        ? field.options
        : field.options.map((option) => ({ label: option, required: false }));
    return (
      <fieldset className={styles.fieldset} aria-describedby={describedBy}>
        <legend className={styles.legend}>{label}</legend>
        {hint}
        <div className={styles.options}>
          {options.map((option, index) => (
            <label key={option.label} className={styles.option}>
              <input
                type="checkbox"
                className={styles.control}
                value={field.type === 'dropdown' ? option.label : undefined}
                {...form.register(
                  (field.type === 'checkboxes' ? `${path}.${index}` : path) as Path<FormValues>,
                )}
              />
              <span className={styles.optionTitle}>
                {option.label}
                {option.required && (
                  <>
                    {' '}
                    <span aria-hidden>*</span>
                    <span className="sr-only">(필수)</span>
                  </>
                )}
              </span>
            </label>
          ))}
        </div>
        {errorText}
      </fieldset>
    );
  }

  const common = {
    id: inputId,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    ...form.register(path),
  };

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      {hint}
      {field.type === 'dropdown' ? (
        <select className={styles.input} {...common}>
          <option value="">골라 주세요</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea className={styles.textarea} rows={5} {...common} />
      ) : (
        <input
          className={styles.input}
          placeholder={'placeholder' in field ? field.placeholder : undefined}
          {...common}
        />
      )}
      {errorText}
    </div>
  );
}
