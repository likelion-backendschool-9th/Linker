'use client';

import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { AltArrowRightLinearIcon } from '@solar-icons/static/linear/alt-arrow-right';
import { useState, type CSSProperties } from 'react';
import { useWatch, type Path } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { todayKst } from '@/lib/format/time';

import {
  boardStatusColorVar,
  ISSUE_STATUS_LABELS,
  type BoardStatusColor,
  type IssueStatus,
} from '../../../../../../_lib/issue-status';
import { IssueAssigneeSheet } from '../../../../_components/issue-sheets/issue-assignee-sheet';
import { IssueLabelSheet } from '../../../../_components/issue-sheets/issue-label-sheet';
import { IssueScheduleSheet } from '../../../../_components/issue-sheets/issue-schedule-sheet';
import type { SchedulePart } from '../../../../_components/issue-sheets/issue-schedule-sheet/hook';
import { IssueStatusSheet } from '../../../../_components/issue-sheets/issue-status-sheet';
import { isInputField } from '../../_lib/form-body';
import type { FormField, ParsedTemplate } from './api';
import styles from './IssueContentStep.module.css';
import {
  EMPTY_TEMPLATE,
  useIssueContentForm,
  useIssueContentTemplate,
  type FormApi,
  type FormValues,
  type IssueContentStepProps,
} from './hook';

const STATUS_COLOR: Record<Exclude<IssueStatus, 'OTHER'>, BoardStatusColor> = {
  TODO: 'GRAY',
  IN_PROGRESS: 'BLUE',
  BLOCKED: 'ORANGE',
  DONE: 'GREEN',
};

const longDate = (day: string) =>
  `${day.slice(0, 4)}년 ${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`;

/** 13 create one page (Figma 200:806 / 368:2098). */
export function IssueContentStep(props: IssueContentStepProps) {
  const { teamId, repoId, templateKey } = props;
  const templateQuery = useIssueContentTemplate(teamId, repoId, templateKey);

  if (repoId !== null && templateKey && templateQuery.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">템플릿을 불러오고 있어요.</p>
        <Skeleton count={2} />
      </div>
    );
  }
  if (repoId !== null && templateKey && templateQuery.isError) {
    return (
      <ErrorState
        title="템플릿을 불러오지 못했어요"
        onRetry={() => void templateQuery.refetch()}
      />
    );
  }

  const template = templateQuery.data ?? EMPTY_TEMPLATE;
  return <ContentForm {...props} template={template} />;
}

function ContentForm(props: IssueContentStepProps & { template: ParsedTemplate }) {
  const {
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
    assigneeCandidates,
    labelQueryOptions,
    template,
    bodyMax,
  } = useIssueContentForm(props);
  const { repoId, repoLabel, templateLabel, onOpenRepo, onOpenTemplate } = props;
  const [preview, setPreview] = useState(false);
  const [schedulePart, setSchedulePart] = useState<SchedulePart>('start');
  const title = useWatch({ control: form.control, name: 'title' }) ?? '';
  const body = useWatch({ control: form.control, name: 'body' }) ?? '';
  const canSubmit = repoId !== null && title.trim().length > 0 && !busy;
  const overdue = Boolean(schedule.dueDate && schedule.dueDate < todayKst() && status !== 'DONE');
  const sep = <span className={styles.separator} aria-hidden />;
  const empty = <span className="sr-only">없음</span>;
  const statusColor = status === 'OTHER' ? 'GRAY' : STATUS_COLOR[status];
  const chevron = (
    <span
      aria-hidden
      className={styles.chevron}
      dangerouslySetInnerHTML={{ __html: AltArrowRightLinearIcon }}
    />
  );
  const down = (
    <span
      aria-hidden
      className={styles.chevron}
      dangerouslySetInnerHTML={{ __html: AltArrowDownLinearIcon }}
    />
  );

  return (
    <>
      {template.fallback && (
        <p className={styles.notice} role="status">
          레포 템플릿을 읽지 못해 기본 템플릿으로 바꿨어요.
        </p>
      )}

      <form
        className={styles.form}
        noValidate
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          void form.handleSubmit(send)(event);
        }}
      >
        <div className={styles.field}>
          <span className={styles.legend} id={`${id}-repo-label`}>
            저장소 선택
            <span className={styles.dot} aria-hidden />
            <span className="sr-only">(필수)</span>
          </span>
          <button
            type="button"
            className={styles.select}
            aria-labelledby={`${id}-repo-label ${id}-repo-value`}
            aria-haspopup="dialog"
            aria-disabled={busy}
            onClick={() => !busy && onOpenRepo()}
          >
            <span id={`${id}-repo-value`} data-empty={!repoLabel || undefined}>
              {repoLabel ?? '저장소를 선택해 주세요'}
            </span>
            {down}
          </button>
        </div>

        <div className={styles.field}>
          <span className={styles.legend} id={`${id}-template-label`}>
            이슈 템플릿
          </span>
          <button
            type="button"
            className={styles.select}
            aria-labelledby={`${id}-template-label ${id}-template-value`}
            aria-haspopup="dialog"
            aria-disabled={busy || repoId === null}
            onClick={() => !busy && onOpenTemplate()}
          >
            <span id={`${id}-template-value`} data-empty={!templateLabel || undefined}>
              {templateLabel ?? '팀에서 공유하는 이슈 템플릿을 선택해 주세요'}
            </span>
            {down}
          </button>
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-title`} className={styles.legend}>
            이슈 제목
            <span className={styles.dot} aria-hidden />
            <span className="sr-only">(필수)</span>
          </label>
          <input
            id={`${id}-title`}
            className={styles.input}
            placeholder="제목을 작성해 주세요"
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
          <div className={styles.bodyBlock}>
            <div className={styles.field}>
              <span className={styles.legend} id={`${id}-body-label`}>
                이슈 본문
                <span className={styles.dot} aria-hidden />
              </span>
              <div className={styles.toggle} role="group" aria-label="본문 보기">
                <button
                  type="button"
                  className={styles.toggleButton}
                  aria-pressed={!preview}
                  onClick={() => setPreview(false)}
                >
                  마크다운 입력
                </button>
                <button
                  type="button"
                  className={styles.toggleButton}
                  aria-pressed={preview}
                  onClick={() => setPreview(true)}
                >
                  미리보기
                </button>
              </div>
            </div>
            {preview ? (
              <div
                className={styles.preview}
                aria-labelledby={`${id}-body-label`}
                data-testid="issue-body-preview"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                  {body}
                </ReactMarkdown>
              </div>
            ) : (
              <div className={styles.bodyWrap}>
                <textarea
                  id={`${id}-body`}
                  className={styles.textarea}
                  placeholder="개발자님을 간단하게 소개해 주세요"
                  maxLength={bodyMax}
                  aria-labelledby={`${id}-body-label`}
                  aria-describedby={`${id}-body-count`}
                  {...form.register('body')}
                />
                <p id={`${id}-body-count`} className={styles.counter} aria-live="polite">
                  {body.length}/{bodyMax}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.formFields}>
            <span className={styles.legend}>
              이슈 본문
              <span className={styles.dot} aria-hidden />
            </span>
            {fields.map((field) => (
              <FormFieldInput key={field.id} field={field} form={form} idPrefix={id} />
            ))}
          </div>
        )}

        <section aria-labelledby={`${id}-props`} className={styles.props}>
          <h2 id={`${id}-props`} className={styles.legend}>
            이슈 양식
            <span className={styles.dot} aria-hidden />
          </h2>
          <ul className={styles.card}>
            <li>
              <button
                type="button"
                className={styles.row}
                aria-haspopup="dialog"
                aria-disabled={busy || repoId === null}
                onClick={open(sheets.status)}
              >
                <span className={styles.term}>상태</span>
                <span className={styles.value}>
                  <span
                    className={styles.status}
                    style={{ '--status-color': boardStatusColorVar(statusColor) } as CSSProperties}
                  >
                    <span className={styles.statusDot} aria-hidden />
                    {ISSUE_STATUS_LABELS[status]}
                  </span>
                  {chevron}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.row}
                aria-haspopup="dialog"
                aria-disabled={busy || repoId === null}
                onClick={open(sheets.labels)}
              >
                <span className={styles.term}>라벨</span>
                <span className={styles.value}>
                  {labelNames.length === 0
                    ? empty
                    : labelNames.map((name, index) => (
                        <span key={name} className={styles.item}>
                          {index > 0 && sep}
                          {name}
                        </span>
                      ))}
                  {chevron}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.row}
                aria-haspopup="dialog"
                aria-disabled={busy || repoId === null}
                onClick={open(sheets.assignees)}
              >
                <span className={styles.term}>담당자</span>
                <span className={styles.value}>
                  {assignees.length === 0
                    ? empty
                    : assignees.map((user, index) => (
                        <span key={user.id} className={styles.item}>
                          {index > 0 && sep}
                          {user.name}
                        </span>
                      ))}
                  {chevron}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.row}
                aria-haspopup="dialog"
                aria-disabled={busy || repoId === null}
                onClick={() => {
                  setSchedulePart('start');
                  open(sheets.schedule)();
                }}
              >
                <span className={styles.term}>시작일</span>
                <span className={styles.value}>
                  {schedule.startDate ? (
                    <time dateTime={schedule.startDate}>{longDate(schedule.startDate)}</time>
                  ) : (
                    empty
                  )}
                  {chevron}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.row}
                aria-haspopup="dialog"
                aria-disabled={busy || repoId === null}
                onClick={() => {
                  setSchedulePart('due');
                  open(sheets.schedule)();
                }}
              >
                <span className={styles.term}>마감일</span>
                <span className={styles.value} data-overdue={overdue}>
                  {schedule.dueDate ? (
                    <time dateTime={schedule.dueDate}>{longDate(schedule.dueDate)}</time>
                  ) : (
                    empty
                  )}
                  {chevron}
                </span>
              </button>
            </li>
          </ul>
        </section>

        {failure && (
          <div className={styles.failure} role="alert">
            <p className={styles.notice}>{failure}</p>
            <button
              type="button"
              className={styles.retry}
              onClick={() => void form.handleSubmit(send)()}
            >
              다시 보내기
            </button>
          </div>
        )}

        {phase === 'syncing' && (
          <div role="status" className={styles.progress}>
            <p className={styles.progressTitle}>GitHub에 반영하고 있어요</p>
            {progressStep ? <p className={styles.progressSteps}>{progressStep}</p> : null}
          </div>
        )}

        <button type="submit" className={styles.submit} aria-disabled={!canSubmit}>
          {phase === 'sending'
            ? '만드는 중…'
            : phase === 'syncing'
              ? '반영하는 중…'
              : 'GitHub에 이슈 작성하기'}
        </button>
      </form>

      {repoId !== null && (
        <>
          <IssueAssigneeSheet
            value={assignees}
            candidates={assigneeCandidates}
            onSave={async (ids) => {
              setAssigneeIds(ids);
              setTouched(true);
            }}
          />
          <IssueLabelSheet
            value={labelObjects}
            options={labelQueryOptions}
            onSave={async (names) => {
              setLabels(names);
              setTouched(true);
            }}
          />
          <IssueScheduleSheet
            part={schedulePart}
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
      )}
    </>
  );
}

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
  type FieldError = { message?: string; root?: { message?: string } };
  const fieldError = (form.formState.errors.answers as Record<string, FieldError> | undefined)?.[
    field.id
  ];
  const error = fieldError?.message ?? fieldError?.root?.message;
  const path = `answers.${field.id}` as Path<FormValues>;

  if (field.type === 'markdown' && 'value' in field) {
    return (
      <div className={styles.preview}>
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
          <span className={styles.dot} aria-hidden />
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
              <span>
                {option.label}
                {option.required && (
                  <>
                    {' '}
                    <span className={styles.dot} aria-hidden />
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
      <label htmlFor={inputId} className={styles.legend}>
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
