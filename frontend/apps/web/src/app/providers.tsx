'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

import { getQueryClient } from '@/lib/api/query-client';

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <LazyMotion features={domAnimation} strict>
          <MotionConfig reducedMotion="user">{children}</MotionConfig>
        </LazyMotion>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
