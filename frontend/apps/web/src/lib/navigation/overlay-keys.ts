/**
 * Every overlay (sheet, modal, drawer, photo viewer) has one key here; it becomes `?overlay=<key>`.
 * Pages add their own keys (e.g. `issue-status`) when they build the overlay.
 */
export const OVERLAY_KEYS = [
  'login',
  'report',
  'block',
  'external-link',
  'delete-confirm',
  'plan-limit',
  'draft-restore',
  'chat-info',
  'appeal',
  'subscription-cancel',
  'payment-refund',
  'issue-filter',
  'issue-assignees',
  'issue-labels',
  'issue-schedule',
  'issue-status',
  'calendar-day',
  'recruit-filter',
  'application-cancel',
  'tech-tags',
  'recruit-status',
  'recruit-menu',
  'recruit-apply',
  'recruit-application',
  'recruit-reject',
  'recruit-team-required',
  'recruit-role-full',
] as const;

export type OverlayKey = (typeof OVERLAY_KEYS)[number];
