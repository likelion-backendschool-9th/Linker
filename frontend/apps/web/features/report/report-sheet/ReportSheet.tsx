'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { apiFetch } from '@/lib/api/api-fetch';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { parseReportTarget, REPORT_REASONS, type ReportReason } from '../report-target';
import styles from './ReportSheet.module.css';

const schema = z
  .object({
    reason: z.enum(REPORT_REASONS.map((r) => r.value) as [ReportReason, ...ReportReason[]], {
      error: '신고 사유를 골라 주세요.',
    }),
    detail: z.string().trim(),
  })
  .refine((values) => values.reason !== 'OTHER' || values.detail.length > 0, {
    path: ['detail'],
    error: '기타 사유를 적어 주세요.',
  });
type ReportForm = z.infer<typeof schema>;

/**
 * Report: choose a reason (+ text for "기타"). Mounted once in providers; open with
 * `useOverlay('report').open(reportTargetId(type, id))`. The reported item disappears for the reporter
 * right away (04 ch. 9), so active queries refetch afterwards.
 * `POST /api/v1/user/reports` (ModerationController) — swap to the orval hook when it is generated.
 */
export function ReportSheet() {
  const overlay = useOverlay('report');
  const target = parseReportTarget(overlay.id);
  const queryClient = useQueryClient();
  const form = useForm<ReportForm>({
    resolver: zodResolver(schema),
    defaultValues: { detail: '' },
    shouldFocusError: true,
  });
  const { errors } = form.formState;
  const reason = useWatch({ control: form.control, name: 'reason' });

  const report = useMutation({
    mutationFn: (values: ReportForm) =>
      apiFetch<void>('/api/v1/user/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: target!.type, targetId: target!.id, ...values }),
      }),
    onSuccess: () => {
      form.reset();
      overlay.close();
      toast('신고를 접수했어요. 검토 결과를 알림으로 알려 드릴게요.');
      void queryClient.invalidateQueries();
    },
  });

  return (
    <OverlaySheet
      overlay={overlay}
      title="신고하기"
      description="신고한 내용은 바로 내 화면에서 숨겨지고, 운영자가 검토해요."
    >
      {target ? (
        <form noValidate onSubmit={form.handleSubmit((values) => report.mutate(values))}>
          <fieldset
            className={styles.reasons}
            aria-describedby={errors.reason ? 'report-reason-error' : undefined}
          >
            <legend className={styles.legend}>
              신고 사유 <span aria-hidden>*</span>
              <span className="sr-only">(필수)</span>
            </legend>
            {REPORT_REASONS.map((option) => (
              <label key={option.value} className={styles.option}>
                <input type="radio" value={option.value} {...form.register('reason')} />
                {option.label}
              </label>
            ))}
          </fieldset>
          {errors.reason && (
            <p id="report-reason-error" className={styles.error} role="alert">
              {errors.reason.message}
            </p>
          )}

          {reason === 'OTHER' && (
            <div className={styles.field}>
              <label htmlFor="report-detail" className={styles.legend}>
                기타 사유 <span aria-hidden>*</span>
                <span className="sr-only">(필수)</span>
              </label>
              <textarea
                id="report-detail"
                className={styles.textarea}
                rows={3}
                aria-invalid={errors.detail ? true : undefined}
                aria-describedby={errors.detail ? 'report-detail-error' : undefined}
                {...form.register('detail')}
              />
              {errors.detail && (
                <p id="report-detail-error" className={styles.error} role="alert">
                  {errors.detail.message}
                </p>
              )}
            </div>
          )}

          <Button type="submit" block className={styles.submit} aria-disabled={report.isPending}>
            신고하기
          </Button>
        </form>
      ) : (
        <p className={styles.error}>신고할 대상을 찾지 못했어요.</p>
      )}
    </OverlaySheet>
  );
}
