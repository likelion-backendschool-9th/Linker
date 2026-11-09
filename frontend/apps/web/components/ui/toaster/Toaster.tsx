'use client';

import { Toast } from 'radix-ui';

import { useToastStore, type ToastItem } from '@/stores/toast-store';

import styles from './Toaster.module.css';

const DURATION_MS = 4000;

/** Renders `toast()` calls. Mounted once in providers: one region per placement, since a Radix
 *  provider owns a single viewport. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const top = toasts.filter((item) => item.placement === 'top');
  const bottom = toasts.filter((item) => item.placement !== 'top');

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
    <Toast.Provider duration={DURATION_MS} label="알림">
      {toasts.map((item) => (
        <Toast.Root
          key={item.id}
          className={styles.toast}
          type={item.tone === 'alert' ? 'foreground' : 'background'}
          onOpenChange={(open) => !open && dismiss(item.id)}
        >
          <Toast.Description className={styles.message}>{item.message}</Toast.Description>
          {item.action && (
            <Toast.Action
              className={styles.action}
              altText={item.action.label}
              onClick={item.action.onClick}
            >
              {item.action.label}
            </Toast.Action>
          )}
        </Toast.Root>
      ))}
      <Toast.Viewport
        className={[styles.viewport, placement === 'top' && styles.viewportTop]
          .filter(Boolean)
          .join(' ')}
      />
    </Toast.Provider>
  );
}
