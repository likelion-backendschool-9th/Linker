'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

import { OverlayRoot } from '@/components/overlay/overlay-root';
import { Toaster } from '@/components/ui/toaster';
import { LoginPromptSheet } from '@/features/auth/login-prompt-sheet';
import { ExternalLinkSheet } from '@/features/external-link/external-link-sheet';
import { MockRoleSwitcher } from '@/features/mock/mock-role-switcher';
import { PlanLimitSheet } from '@/features/plan-limit/plan-limit-sheet';
import { ReportSheet } from '@/features/report/report-sheet';
import { getQueryClient } from '@/lib/api/query-client';
import { ViewerProvider, type ClientViewer } from '@/lib/auth/viewer-context';
import { NativeBridgeProvider } from '@/lib/bridge/native-bridge-provider';

/** App-wide clients plus the overlays any screen can open (login, limit, external link, report). */
export function Providers({ viewer, children }: { viewer: ClientViewer; children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <ViewerProvider viewer={viewer}>
          <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion="user">
              <NativeBridgeProvider>
                {children}
                <OverlayRoot />
                <LoginPromptSheet />
                <PlanLimitSheet />
                <ExternalLinkSheet />
                <ReportSheet />
                <Toaster />
                <MockRoleSwitcher />
              </NativeBridgeProvider>
            </MotionConfig>
          </LazyMotion>
        </ViewerProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
