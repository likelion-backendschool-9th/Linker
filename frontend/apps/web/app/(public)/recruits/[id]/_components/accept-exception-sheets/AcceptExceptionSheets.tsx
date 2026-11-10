'use client';

// Overlay: the role-full exception of an invite (04 ch. 5). Free-team member/role caps come back as
// PLAN_LIMIT and are shown as a reason only — no Flex/BM upsell on 21 (07 TODO 21). Recruit posts always
// have a team (20), so there is no "create a team first" path here.
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import type { RecruitDetail } from '../../_lib/detail-queries';
import { AcceptedPanel } from '../accepted-panel';
import { inviteFailureMessage } from '../applicant-list/hook';
import styles from '../detail-sheets.module.css';
import { useAcceptExceptionSheets, useRoleFullBody } from './hook';

export function AcceptExceptionSheets({ recruit }: { recruit: RecruitDetail }) {
  const { roleFull } = useAcceptExceptionSheets();

  return (
    <>
      <OverlaySheet
        overlay={roleFull}
        title="이 역할은 자리가 다 찼어요"
        description="인원을 1명 늘리고 바로 초대할 수 있어요."
      >
        {roleFull.isOpen && roleFull.id && (
          <RoleFullBody
            key={roleFull.id}
            recruit={recruit}
            applicationId={roleFull.id}
            overlay={roleFull}
          />
        )}
      </OverlaySheet>
    </>
  );
}

type RoleFullBodyProps = { recruit: RecruitDetail; applicationId: string; overlay: OverlayControl };

/** "인원 늘리고 초대": Flex teams bump headcount + accept; free teams get PLAN_LIMIT, shown as a reason */
function RoleFullBody({ recruit, applicationId, overlay }: RoleFullBodyProps) {
  const { row, role, atMax, accepted, accept, headcountMax, close, acceptWithIncrease } =
    useRoleFullBody({ recruit, applicationId, overlay });

  if (accepted && row) {
    return (
      <AcceptedPanel
        result={accepted}
        applicantId={row.applicant.id}
        applicantName={row.applicant.name}
      />
    );
  }

  return (
    <div className={styles.body}>
      {role && (
        <p className={styles.notice}>
          {role.name} {role.headcount}명 → {Math.min(role.headcount + 1, headcountMax)}명
        </p>
      )}
      {atMax && <p className={styles.hint}>한 역할은 {headcountMax}명까지라 더 늘릴 수 없어요.</p>}
      {accept.isError && (
        <p className={styles.error} role="alert">
          {inviteFailureMessage(accept.error)}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="outline" onClick={close}>
          취소
        </Button>
        {!atMax && (
          <Button aria-disabled={accept.isPending || !row} onClick={acceptWithIncrease}>
            {accept.isPending ? '초대하는 중…' : '인원 늘리고 초대'}
          </Button>
        )}
      </div>
    </div>
  );
}
