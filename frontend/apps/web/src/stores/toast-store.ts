import { create } from 'zustand';

export type ToastAction = { label: string; onClick: () => void };

export type ToastItem = {
  id: number;
  message: string;
  /** `alert` for failures (assertive), `status` otherwise (polite); blueprint §6-2 */
  tone: 'status' | 'alert';
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
  const item: ToastItem = { id: nextId++, message, tone: options.tone ?? 'status', ...options };
  useToastStore.setState((state) => ({ toasts: [...state.toasts, item] }));
}
