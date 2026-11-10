'use client';

import { Toast } from 'radix-ui';

import { useToastStore, type ToastItem, type ToastTone } from '@/stores/toast-store';

import styles from './Toaster.module.css';

/**
 * How long each kind stays up (ms). `persistent` never times out: the caller removes it with
 * `dismissToast(key)` once the state it reports is over. A toast with an action gets more time to tap.
 */
const DURATION_MS: Record<ToastTone, number> = {
  success: 3000,
  info: 3000,
  error: 5000,
  persistent: Infinity,
};
const ACTION_DURATION_MS = 6000;

/** Dot color per kind (Figma 877:415); `info` has no dot */
const DOT_CLASS: Partial<Record<ToastTone, string>> = {
  success: styles.dotSuccess,
  error: styles.dotError,
  persistent: styles.dotPersistent,
};

/** Renders `toast()` calls. Mounted once in providers: one region per placement, since a Radix
 *  provider owns a single viewport. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const top = toasts.filter((item) => item.placement !== 'bottom');
  const bottom = toasts.filter((item) => item.placement === 'bottom');

  return (
    <>
      <ToastRegion toasts={bottom} placement="bottom" />
      <ToastRegion toasts={top} placement="top" />
    </>
  );
}

function ToastRegion({
  toasts,
  placement,
}: {
  toasts: ToastItem[];
  placement: 'top' | 'bottom';
}) {
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <Toast.Provider label="알림">
      {toasts.map((item) => {
        // An action toast (되돌리기, 채팅방으로 가기) has no dot: the blue action label marks it instead
        const dot = item.action ? undefined : DOT_CLASS[item.tone];
        const action = item.action;
        return (
          <Toast.Root
            key={item.id}
            className={action ? `${styles.toast} ${styles.actionable}` : styles.toast}
            data-tone={item.tone}
            // Tapping anywhere on an action toast runs its action (the action button itself bubbles
            // here too, so the action is wired once, on the toast)
            onClick={
              action
                ? () => {
                    action.onClick();
                    dismiss(item.id);
                  }
                : undefined
            }
            duration={item.action ? ACTION_DURATION_MS : DURATION_MS[item.tone]}
            // Errors are announced assertively, the rest politely (Radix foreground / background)
            type={item.tone === 'error' ? 'foreground' : 'background'}
            onOpenChange={(open) => !open && dismiss(item.id)}
          >
            {dot && <span className={`${styles.dot} ${dot}`} aria-hidden />}
            <Toast.Description className={styles.message}>{item.message}</Toast.Description>
            {action && (
              <Toast.Action className={styles.action} altText={action.label}>
                {action.label}
              </Toast.Action>
            )}
          </Toast.Root>
        );
      })}
      <Toast.Viewport
        className={[styles.viewport, placement === 'top' && styles.viewportTop]
          .filter(Boolean)
          .join(' ')}
      />
    </Toast.Provider>
  );
}
