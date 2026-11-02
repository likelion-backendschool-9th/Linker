'use client';

// Overlays: the acceptance exceptions with their own sheet (04 ch. 5). A free team at its member cap
// comes back as PLAN_LIMIT and opens the shared limit sheet with the Flex prompt.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';
import { RECRUIT } from '@/lib/policy';

import {
  acceptApplication,
  applicantsOptions,
  type AcceptResult,
  type RecruitDetail,
} from '../_lib/detail-queries';
import { AcceptedPanel } from './accepted-panel';
import styles from './detail-sheets.module.css';

// 08 team creation (B); typed once that route exists
const TEAM_CREATE = '/teams/new' as Route;

export function AcceptExceptionSheets({ recruit }: { recruit: RecruitDetail }) {
  const teamRequired = useOverlay('recruit-team-required');
  const roleFull = useOverlay('recruit-role-full');

  return (
    <>
      <OverlaySheet
        overlay={teamRequired}
        title="팀을 먼저 만들어 주세요"
        description="수락하면 지원자가 팀에 들어와요. GitHub 조직을 연결해 팀을 만든 뒤 수락할 수 있어요. 그동안 지원은 검토 중으로 남아요."
      >
        <div className={styles.actions}>
          <Button variant="outline" onClick={() => teamRequired.close()}>
            나중에 하기
          </Button>
          <Button onClick={() => void teamRequired.closeThen(TEAM_CREATE)}>팀 먼저 만들기</Button>
        </div>
      </OverlaySheet>

      <OverlaySheet
        overlay={roleFull}
        title="이 역할은 자리가 다 찼어요"
        description="인원을 1명 늘리면 바로 수락할 수 있어요."
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

/** "인원 늘리고 수락": one call, so headcount and acceptance change together */
function RoleFullBody({ recruit, applicationId, overlay }: RoleFullBodyProps) {
  const viewer = useViewer();
  const client = useQueryClient();
  const recruitId = String(recruit.id);
  const applicants = useQuery(applicantsOptions(viewer.login, recruitId));
  const row = applicants.data?.items.find((item) => item.id === Number(applicationId));
  const role = recruit.roles.find((item) => item.id === row?.roleId);
  const atMax = role !== undefined && role.headcount >= RECRUIT.headcountPerRole.max;
  const [accepted, setAccepted] = useState<AcceptResult | null>(null);

  const accept = useMutation({
    mutationFn: () =>
      acceptApplication(recruitId, Number(applicationId), { increaseHeadcount: true }),
    onSuccess: async (result) => {
      setAccepted(result);
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
  });

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
          {role.name} {role.headcount}명 →{' '}
          {Math.min(role.headcount + 1, RECRUIT.headcountPerRole.max)}명
        </p>
      )}
      {atMax && (
        <p className={styles.hint}>
          한 역할은 {RECRUIT.headcountPerRole.max}명까지라 더 늘릴 수 없어요.
        </p>
      )}
      {accept.isError && accept.error instanceof ApiError && accept.error.code !== 'PLAN_LIMIT' && (
        <p className={styles.error} role="alert">
          {accept.error.message}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="outline" onClick={() => overlay.close()}>
          취소
        </Button>
        {!atMax && (
          <Button
            aria-disabled={accept.isPending || !row}
            onClick={() => {
              if (!accept.isPending && row) accept.mutate();
            }}
          >
            {accept.isPending ? '수락하는 중…' : '인원 늘리고 수락'}
          </Button>
        )}
      </div>
    </div>
  );
}
