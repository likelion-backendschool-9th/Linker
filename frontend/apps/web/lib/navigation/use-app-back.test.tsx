import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';

import { useUnsavedChangesStore } from '@/stores/unsaved-changes-store';

import { useAppBack } from './use-app-back';
import * as navDepth from './nav-depth';

const back = vi.fn();
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back, replace, push: vi.fn() }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

describe('useAppBack', () => {
  beforeEach(() => {
    back.mockReset();
    replace.mockReset();
    useUnsavedChangesStore.setState({ isDirty: false });
  });

  it('goes back when in-app depth is available', () => {
    vi.spyOn(navDepth, 'getNavDepth').mockReturnValue(2);
    const { result } = renderHook(() => useAppBack('/feed'), { wrapper });
    act(() => result.current());
    expect(back).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });

  it('replaces to the fallback when depth is 0 so shared links never leave Linker', () => {
    vi.spyOn(navDepth, 'getNavDepth').mockReturnValue(0);
    const { result } = renderHook(() => useAppBack('/feed'), { wrapper });
    act(() => result.current());
    expect(replace).toHaveBeenCalledWith('/feed');
    expect(back).not.toHaveBeenCalled();
  });

  it('opens the leave confirmation instead of navigating when the form is dirty', () => {
    useUnsavedChangesStore.setState({ isDirty: true });
    vi.spyOn(navDepth, 'getNavDepth').mockReturnValue(2);
    const { result } = renderHook(() => useAppBack('/feed'), { wrapper });
    act(() => result.current());
    expect(back).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
