import { create } from 'zustand';

type UnsavedChangesState = {
  isDirty: boolean;
  setDirty: (isDirty: boolean) => void;
};

/** A focused navigation guard used by edit forms with an in-page confirmation dialog. */
export const useUnsavedChangesStore = create<UnsavedChangesState>((set) => ({
  isDirty: false,
  setDirty: (isDirty) => set({ isDirty }),
}));
