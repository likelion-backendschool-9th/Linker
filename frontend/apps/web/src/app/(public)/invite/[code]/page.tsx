import Image from 'next/image';
import Link from 'next/link';

import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError } from '@/lib/api/api-error';
import styles from '@/features/teams/team-ui.module.css';
import { buildMetadata } from '@/lib/seo/metadata';

import { InviteAcceptArea } from './_components/invite-accept-area';
import { getInvite } from './_lib/get-invite';

export async function generateMetadata({ params }: PageProps<'/invite/[code]'>) {
  const { code } = await params;
  try {
    const invite = await getInvite(code);
    return invite.status === 'VALID'
      ? buildMetadata({
          title: `${invite.team.name} 팀 초대`,
          description: invite.team.description,
          image: invite.team.orgAvatarUrl,
          path: `/invite/${code}`,
        })
      : buildMetadata({ title: '팀 초대' });
  } catch (error) {
    if (!(error instanceof ApiError && [404, 410].includes(error.status))) throw error;
    return buildMetadata({ title: '팀 초대' });
  }
}

export default async function InvitePage({ params }: PageProps<'/invite/[code]'>) {
  const { code } = await params;
  let invite;
  try {
    invite = await getInvite(code);
  } catch (error) {
    if (!(error instanceof ApiError && [404, 410].includes(error.status))) throw error;
  }
  if (!invite || invite.status !== 'VALID')
    return (
      <PageFrame title="팀 초대">
        <EmptyState
          title={
            invite?.status === 'EXPIRED'
              ? '초대 링크의 유효 기간이 지났어요.'
              : '더 이상 쓸 수 없는 초대 링크예요.'
          }
          description="팀 오너나 관리자에게 새 초대 링크를 요청해 주세요."
          action={
            <Button asChild variant="outline">
              <Link href="/feed">홈으로 가기</Link>
            </Button>
          }
        />
      </PageFrame>
    );
  return (
    <PageFrame title="팀 초대">
      <div className={styles.stack}>
        <section className={`${styles.card} ${styles.stack}`} aria-labelledby="invited-team-title">
          <div className={styles.row}>
            <Image
              className={styles.avatar}
              src={invite.team.orgAvatarUrl}
              alt=""
              width={64}
              height={64}
              sizes="64px"
            />
            <div className={styles.body}>
              <p className={styles.meta}>{invite.invitedBy}님이 초대했어요</p>
              <h2 id="invited-team-title" className={styles.title}>
                {invite.team.name}
              </h2>
              <p className={styles.description}>{invite.team.memberCount}명이 함께하고 있어요.</p>
            </div>
          </div>
          <p>{invite.team.description}</p>
          <InviteAcceptArea
            code={code}
            teamId={invite.team.id}
            participation={invite.participation}
          />
          <p className={styles.description}>
            GitHub 조직 초대를 수락해야 이슈 담당자가 될 수 있어요.
          </p>
        </section>
      </div>
    </PageFrame>
  );
}
