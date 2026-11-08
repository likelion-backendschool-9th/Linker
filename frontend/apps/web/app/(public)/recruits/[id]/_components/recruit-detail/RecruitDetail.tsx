'use client';

// Client boundary: viewer-dependent actions (apply / cancel / applicants drawer), sheets
import { AltArrowRightLinearIcon } from '@solar-icons/static/linear/alt-arrow-right';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { RECRUIT_FORMAT_LABELS, RECRUIT_GOAL_LABELS } from '@/features/recruit/recruit-labels';
import { formatDeadlineDate } from '@/lib/format/time';

import type { RecruitDetail as Detail, RecruitTeamMember } from '../../_lib/detail-queries';
import { AcceptExceptionSheets } from '../accept-exception-sheets';
import { ApplicantsSheet } from '../applicant-list';
import { ApplicationSheet } from '../application-sheet';
import { RecruitApplySheet } from '../recruit-apply-sheet';
import { RecruitMenuSheet } from '../recruit-menu-sheet';
import { RejectSheet } from '../reject-sheet';
import styles from './RecruitDetail.module.css';
import { useActionPanel, usePostView, useRecruitDetail } from './hook';

const TECH_TAG_VISIBLE = 4;

const TEAM_ROLE_LABELS = {
  OWNER: '오너',
  ADMIN: '멤버',
  MEMBER: '멤버',
} as const;

/**
 * 21 Recruit post detail (Figma 92:578). Authors open applicants from the bottom CTA drawer.
 */
export function RecruitDetail({ recruitId }: { recruitId: string }) {
  const { detail, recruit } = useRecruitDetail(recruitId);

  if (detail.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">모집 글을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  }
  if (detail.isError || !recruit) return <ErrorState onRetry={() => void detail.refetch()} />;

  const author = recruit.isAuthor;

  return (
    <>
      <PostView recruit={recruit} />

      <RecruitApplySheet recruit={recruit} />
      {author && (
        <>
          <ApplicantsSheet recruit={recruit} />
          <ApplicationSheet recruit={recruit} />
          <RejectSheet recruitId={recruitId} />
          <AcceptExceptionSheets recruit={recruit} />
        </>
      )}
    </>
  );
}

function PostView({ recruit }: { recruit: Detail }) {
  const { closed } = usePostView(recruit);
  const totalHeadcount = recruit.roles.reduce((sum, role) => sum + role.headcount, 0);
  const totalFilled = recruit.roles.reduce((sum, role) => sum + role.filled, 0);
  const visibleTags = recruit.techTags.slice(0, TECH_TAG_VISIBLE);
  const hiddenTagCount = Math.max(0, recruit.techTags.length - TECH_TAG_VISIBLE);

  const hideBottomBar = recruit.isTeamMember && !recruit.isAuthor;

  return (
    <div className={hideBottomBar ? styles.layoutNoCta : styles.layout}>
      <article aria-labelledby="recruit-title" className={styles.main}>
        <header className={styles.head}>
          <div className={styles.titleBlock}>
            <div className={styles.titleLead}>
              <div className={styles.chips}>
                <span className={styles.formatChip}>{RECRUIT_FORMAT_LABELS[recruit.format]}</span>
                {recruit.goal && (
                  <span className={styles.goalChip}>{RECRUIT_GOAL_LABELS[recruit.goal]}</span>
                )}
              </div>
              <div className={styles.titleRow}>
                <h2 id="recruit-title" className={styles.title}>
                  {recruit.title}
                </h2>
                <div className={styles.titleActions}>
                  <RecruitMenuSheet recruit={recruit} />
                </div>
              </div>
            </div>
            <p className={styles.deadline}>
              <time dateTime={recruit.deadline}>
                {closed ? '모집 마감' : formatDeadlineDate(recruit.deadline)}
              </time>
            </p>
          </div>
          <p className={styles.intro}>{recruit.intro}</p>
          {recruit.techTags.length > 0 && (
            <ul className={styles.tags} aria-label="기술 스택">
              {visibleTags.map((tag) => (
                <li key={tag} className={styles.tag}>
                  {tag}
                </li>
              ))}
              {hiddenTagCount > 0 && (
                <li className={styles.tag} aria-label={`외 ${hiddenTagCount}개`}>
                  +{hiddenTagCount}
                </li>
              )}
            </ul>
          )}
        </header>

        <section aria-labelledby="recruit-roles" className={styles.rolesSection}>
          <div className={styles.sectionHead}>
            <h3 id="recruit-roles" className={styles.sectionTitle}>
              모집 역할
            </h3>
            <p className={styles.sectionMeta}>
              전체 {totalHeadcount}명 중 {totalFilled}명 모집 완료
            </p>
          </div>
          <ul className={styles.roles}>
            {recruit.roles.map((role) => {
              const full = role.remaining <= 0;
              return (
                <li key={role.id} className={styles.role}>
                  <span className={styles.roleName}>{role.name}</span>
                  <span className={styles.roleStatus}>
                    <span className={full ? styles.roleFilled : styles.roleOpen}>
                      {role.filled}/{role.headcount}
                    </span>
                    <span className={styles.roleLabel}>{full ? '마감' : '모집 중'}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <TeamProfiles members={recruit.teamMembers} />
      </article>

      <ActionPanel recruit={recruit} closed={closed} />
    </div>
  );
}

function TeamProfiles({ members }: { members: RecruitTeamMember[] }) {
  return (
    <section aria-labelledby="recruit-team" className={styles.teamSection}>
      <div className={styles.sectionHeadInline}>
        <h3 id="recruit-team" className={styles.sectionTitle}>
          팀원 프로필
        </h3>
        <p className={styles.sectionMeta}>총 {members.length}명</p>
      </div>
      <ul className={styles.members}>
        {members.map((member) => (
          <li key={member.id}>
            <Link
              href={`/user/${member.login}` as Route}
              className={styles.memberRow}
              aria-label={`${member.name} 프로필 보기`}
            >
              <Image
                src={member.avatarUrl}
                alt=""
                width={40}
                height={40}
                sizes="40px"
                className={styles.memberAvatar}
              />
              <span className={styles.memberText}>
                <span className={styles.memberBadges}>
                  <span className={styles.memberRole}>{TEAM_ROLE_LABELS[member.teamRole]}</span>
                  {member.isAuthor && <span className={styles.authorBadge}>작성자</span>}
                </span>
                <span className={styles.memberName}>
                  {member.name} @{member.login}
                </span>
              </span>
              <Icon svg={AltArrowRightLinearIcon} className={styles.memberChevron} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

type ActionPanelProps = { recruit: Detail; closed: boolean };

/**
 * Bottom bar: applicants CTA for authors; apply/status for others.
 * Recruiters only read; other team members get no CTA (same as author apply ban).
 */
function ActionPanel({ recruit, closed }: ActionPanelProps) {
  const {
    viewer,
    mine,
    suspended,
    confirm,
    cancelPending,
    openApply,
    openApplicants,
    openCancel,
    confirmCancel,
  } = useActionPanel(recruit);

  // Recruiters only read (04 ch. 2). Non-author team members have nothing to do here.
  if (viewer.role === 'recruiter' || (recruit.isTeamMember && !recruit.isAuthor)) return null;

  let content;
  if (recruit.isAuthor) {
    content = (
      <Button block className={styles.applyCta} onClick={openApplicants}>
        지원자 {recruit.applicantCount}명 보기
      </Button>
    );
  } else if (mine?.status === 'PENDING') {
    const roleName = recruit.roles.find((role) => role.id === mine.roleId)?.name;
    content = (
      <div className={styles.actionRow}>
        <p className={styles.actionStatus}>
          <span className={styles.pendingBadge}>검토 중</span>
          {roleName && <span>지원 역할 {roleName}</span>}
        </p>
        <Button variant="danger" disabled={cancelPending || suspended} onClick={openCancel}>
          지원 취소
        </Button>
      </div>
    );
  } else if (mine?.status === 'ACCEPTED') {
    content = (
      <div className={styles.actionStack}>
        <p className={styles.acceptedText}>함께하게 됐어요</p>
        {mine.teamChatRoomId !== null && (
          <Button block asChild>
            <Link href={`/chats/${mine.teamChatRoomId}` as Route}>팀 채팅 바로가기</Link>
          </Button>
        )}
      </div>
    );
  } else if (mine?.status === 'REJECTED' || mine?.status === 'EXPIRED') {
    content = (
      <p className={styles.actionNote}>
        {mine.status === 'REJECTED' ? '이번엔 함께하지 못하게 됐어요' : '모집이 끝났어요'}
      </p>
    );
  } else if (closed) {
    content = <p className={styles.actionNote}>모집이 끝났어요</p>;
  } else {
    content = (
      <Button block className={styles.applyCta} aria-disabled={suspended} onClick={openApply}>
        지원하기
      </Button>
    );
  }

  return (
    <div className={styles.actionBar}>
      {content}
      <ConfirmDialog
        overlay={confirm}
        title="지원을 취소할까요?"
        description="취소한 모집 글에는 한 번만 다시 지원할 수 있어요."
        confirmLabel="지원 취소"
        destructive
        pending={cancelPending}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
