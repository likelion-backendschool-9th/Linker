'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';

import { usePushPermissionSheet } from './hook';
import styles from './PushPermissionSheet.module.css';

/** Android first-launch explanation; OS permission is requested only after the user's action. */
export function PushPermissionSheet() {
  const { androidApp, overlay, pending, error, requestPermission } = usePushPermissionSheet();
  if (!androidApp) return null;

  return (
    <OverlaySheet
      overlay={overlay}
      title="푸시 알림"
      description="채팅과 알림을 Android 앱에서 받아요."
    >
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="outline" block onClick={overlay.close}>
          나중에
        </Button>
        <Button block disabled={pending} onClick={() => void requestPermission()}>
          {pending ? '권한 확인 중…' : '알림 허용하기'}
        </Button>
      </div>
    </OverlaySheet>
  );
}
