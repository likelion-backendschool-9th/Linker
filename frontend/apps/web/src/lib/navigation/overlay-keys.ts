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
] as const;

export type OverlayKey = (typeof OVERLAY_KEYS)[number];
