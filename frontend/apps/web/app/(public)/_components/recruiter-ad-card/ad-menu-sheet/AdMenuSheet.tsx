'use client';

// Overlay: job ad "더보기" — hide for good, or report (07 TODO 24). Mounted once per screen.
import { EyeOff, Flag } from 'lucide-react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';

import { useAdMenuSheet } from './hook';
import menuStyles from './AdMenuSheet.module.css';

export function AdMenuSheet({ onHidden }: { onHidden: (adId: number) => void }) {
  const { menu, adId, hidePending, hideAd, openReport } = useAdMenuSheet(onHidden);

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
            disabled={hidePending || !adId}
            onClick={hideAd}
          >
            <EyeOff aria-hidden />이 광고 숨기기
          </button>
        </li>
        <li>
          {/* Opening another overlay replaces this one in the URL (blueprint ch. 7) */}
          <button type="button" className={menuStyles.item} onClick={openReport}>
            <Flag aria-hidden />
            신고
          </button>
        </li>
      </ul>
    </OverlaySheet>
  );
}
