'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { BridgeSession } from '@linker/bridge';
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

import { OverlayRoot } from '@/components/overlay/overlay-root/OverlayRoot';
import { LoadTimeoutScreen } from '@/components/ui/page-loading';
import { Toaster } from '@/components/ui/toaster/Toaster';
import { LoginPromptSheet } from '@/features/auth/login-prompt-sheet/LoginPromptSheet';
import { SessionClaimSync } from '@/features/auth/session-claim-sync/SessionClaimSync';
import { ExternalLinkSheet } from '@/features/external-link/external-link-sheet/ExternalLinkSheet';
import { MockRoleSwitcher } from '@/features/mock/mock-role-switcher/MockRoleSwitcher';
import { NotificationRealtime } from '@/features/notifications/notification-realtime/NotificationRealtime';
import { PlanLimitSheet } from '@/features/plan-limit/plan-limit-sheet/PlanLimitSheet';
import { ReportSheet } from '@/features/report/report-sheet/ReportSheet';
import { getQueryClient } from '@/lib/api/query-client';
import { ViewerProvider, type ClientViewer } from '@/lib/auth/viewer-context';
import { NativeBridgeProvider } from '@/lib/bridge/native-bridge-provider';

/** App-wide clients plus the overlays any screen can open (login, limit, external link, report). */
export function Providers({
  viewer,
  children,
  nativeSession = null,
}: {
  viewer: ClientViewer;
  children: ReactNode;
  nativeSession?: BridgeSession | null;
}) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <ViewerProvider viewer={viewer}>
          <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion="user">
              <NativeBridgeProvider session={nativeSession}>
                {children}
                <NotificationRealtime />
                <SessionClaimSync />
                <OverlayRoot />
                <LoginPromptSheet />
                <PlanLimitSheet />
                <ExternalLinkSheet />
                <ReportSheet />
                <Toaster />
                <LoadTimeoutScreen />
                <MockRoleSwitcher />
              </NativeBridgeProvider>
            </MotionConfig>
          </LazyMotion>
        </ViewerProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
