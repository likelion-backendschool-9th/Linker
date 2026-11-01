'use client';

// Overlay: job ad "더보기" — hide for good, or report (07 TODO 24). Mounted once per screen.
import { useMutation } from '@tanstack/react-query';
import { EyeOff, Flag } from 'lucide-react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { reportTargetId } from '@/features/report/report-target';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { hideAd } from './ad-api';
import menuStyles from './ad-menu-sheet.module.css';

export function AdMenuSheet({ onHidden }: { onHidden: (adId: number) => void }) {
  const menu = useOverlay('ad-menu');
  const report = useOverlay('report');
  const adId = Number(menu.id);

  const hide = useMutation({
    mutationFn: (id: number) => hideAd(id),
    onSuccess: (_result, id) => {
      menu.close();
      onHidden(id);
      toast('이 광고는 다시 보이지 않아요.');
    },
    onError: () => toast('광고를 숨기지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'alert' }),
  });

  return (
    <OverlaySheet
      overlay={menu}
      title="광고 더보기"
      description="이 광고에 할 수 있는 일이에요."
      describeHidden
    >
      <ul className={menuStyles.menu}>
        <li>
          <button
            type="button"
            className={menuStyles.item}
            disabled={hide.isPending || !adId}
            onClick={() => hide.mutate(adId)}
          >
            <EyeOff aria-hidden />이 광고 숨기기
          </button>
        </li>
        <li>
          {/* Opening another overlay replaces this one in the URL (blueprint ch. 7) */}
          <button
            type="button"
            className={menuStyles.item}
            onClick={() => report.open(reportTargetId('RECRUITER_AD', adId))}
          >
            <Flag aria-hidden />
            신고
          </button>
        </li>
      </ul>
    </OverlaySheet>
  );
}
