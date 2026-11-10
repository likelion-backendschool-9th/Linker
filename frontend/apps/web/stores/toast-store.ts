import { create } from 'zustand';

export type ToastAction = { label: string; onClick: () => void };

/**
 * Four kinds (Figma 877:415; which response gets which: blueprint §5-5):
 * `success` blue dot, 3 s · `error` red dot, 5 s, announced at once ·
 * `info` no dot, 3 s · `persistent` orange dot, stays until `dismissToast(key)`.
 */
export type ToastTone = 'success' | 'error' | 'info' | 'persistent';

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  /** `top` drops in under the stack header (e.g. 20 form errors, where the bottom holds a CTA); default `bottom` */
  placement?: 'top' | 'bottom';
  /** A new toast with the same key replaces the one already up instead of stacking */
  key?: string;
  action?: ToastAction;
};

type ToastState = {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}));

/** Shows a toast from anywhere (handlers, mutation callbacks). Rendered by `<Toaster>` in providers. */
export function toast(message: string, options: Omit<Partial<ToastItem>, 'id' | 'message'> = {}) {
  const item: ToastItem = { id: nextId++, message, ...options, tone: options.tone ?? 'success' };
  useToastStore.setState((state) => ({
    toasts: [
      ...state.toasts.filter((other) => item.key === undefined || other.key !== item.key),
      item,
    ],
  }));
}

/** Removes the toast with this key, if one is up */
export function dismissToast(key: string) {
  useToastStore.setState((state) => ({
    toasts: state.toasts.filter((item) => item.key !== key),
  }));
}
