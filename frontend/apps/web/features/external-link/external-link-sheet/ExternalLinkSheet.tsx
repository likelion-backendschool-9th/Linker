'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { confirmDomain, openExternalNow, parseHttpsUrl } from '../open-external';
import styles from './ExternalLinkSheet.module.css';

/** External site confirm, first time per domain (04 ch. 2). Mounted once in providers; the URL is the overlay `oid`. */
export function ExternalLinkSheet() {
  const overlay = useOverlay('external-link');
  const url = overlay.id ? parseHttpsUrl(overlay.id) : null;

  function onConfirm() {
    if (!url) return;
    confirmDomain(url.hostname);
    openExternalNow(url.href);
    overlay.close();
  }

  return (
    <OverlaySheet
      overlay={overlay}
      title="외부 사이트로 이동합니다"
      description={
        url ? `${url.hostname}(으)로 이동해요. 새 창에서 열려요.` : '열 수 없는 주소예요.'
      }
    >
      <div className={styles.actions}>
        <Button variant="outline" block onClick={overlay.close}>
          취소
        </Button>
        {url && (
          <Button block onClick={onConfirm}>
            이동
          </Button>
        )}
      </div>
    </OverlaySheet>
  );
}
