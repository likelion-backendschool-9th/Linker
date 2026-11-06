'use client';

import type { Route } from 'next';
import { useEffect } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { useAppSignalStore } from '@/stores/app-signal-store';

/**
 * Limit-reached subscription prompt (07 TODO 00). Mounted once in providers; opens on API PLAN_LIMIT
 * with the server's copy, and leads to `/subscribe?reason=` (blueprint §5-4).
 */
export function PlanLimitSheet() {
  const overlay = useOverlay('plan-limit');
  const planLimit = useAppSignalStore((state) => state.planLimit);
  const { open } = overlay;

  useEffect(() => {
    if (planLimit) open();
    // A new PLAN_LIMIT opens the sheet; re-renders don't
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planLimit]);

  const reason = planLimit?.reason ?? '';

  return (
    <OverlaySheet
      overlay={overlay}
      title="지금 플랜으로는 더 할 수 없어요"
      description={planLimit?.message ?? '구독하면 한도가 늘어나요.'}
    >
      <Button
        block
        onClick={() => {
          useAppSignalStore.setState({ planLimit: null });
          overlay.closeThen(
            (reason ? `/subscribe?reason=${encodeURIComponent(reason)}` : '/subscribe') as Route,
          );
        }}
      >
        구독 알아보기
      </Button>
    </OverlaySheet>
  );
}
