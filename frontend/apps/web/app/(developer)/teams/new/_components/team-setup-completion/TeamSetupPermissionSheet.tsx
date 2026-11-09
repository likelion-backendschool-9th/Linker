'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button/Button';
import { useTeamSetupCompletion } from './hook';

export function TeamSetupPermissionSheet({
  finish,
}: {
  finish: ReturnType<typeof useTeamSetupCompletion>;
}) {
  return (
    <OverlaySheet
      overlay={finish.overlay}
      title="GitHub 권한 설정"
      description="팀원이 이슈에 담당자·라벨을 정하려면 쓰기 권한이 필요해요"
    >
      {finish.permission?.settingsUrl && (
        <Button
          variant="outline"
          onClick={() => finish.openExternal(finish.permission!.settingsUrl)}
        >
          GitHub 권한 설정 보기
        </Button>
      )}
      <Button disabled={finish.pending} onClick={finish.continue}>
        계속하기
      </Button>
    </OverlaySheet>
  );
}
