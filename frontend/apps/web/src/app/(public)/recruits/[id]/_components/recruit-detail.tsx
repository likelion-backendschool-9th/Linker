'use client';

// Client boundary: viewer-dependent actions (apply / cancel / author tabs), sheets, URL tab
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequireLogin } from '@/features/auth/use-require-login';
import { RECRUIT_FORMAT_LABELS, RECRUIT_GOAL_LABELS } from '@/features/recruit/recruit-labels';
import { useViewer } from '@/lib/auth/viewer-context';
import { daysUntil, formatDate } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { cancelApplication } from '../../_lib/recruit-list-queries';
import { recruitDetailOptions, type RecruitDetail as Detail } from '../_lib/detail-queries';
import { AcceptExceptionSheets } from './accept-exception-sheets';
import { ApplicantList } from './applicant-list';
import { ApplicationSheet } from './application-sheet';
import { RecruitApplySheet } from './recruit-apply-sheet';
import styles from './recruit-detail.module.css';
import { RecruitMenuSheet } from './recruit-menu-sheet';
import { RejectSheet } from './reject-sheet';

const TABS = ['post', 'applicants'] as const;

/**
 * 21 Recruit post detail (07 TODO 21). Everyone reads the post; guests get the login prompt on apply,
 * recruiters only read, applicants see their status, and the author gets a "지원자 N" tab.
 */
export function RecruitDetail({ recruitId }: { recruitId: string }) {
  const viewer = useViewer();
  const detail = useQuery(recruitDetailOptions(viewer.login, recruitId));
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TABS).withDefault('post'));

  if (detail.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">모집 글을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  }
  if (detail.isError) return <ErrorState onRetry={() => void detail.refetch()} />;

  const recruit = detail.data;
  const author = recruit.isAuthor;

  return (
    <>
      {author && (
        <div role="group" aria-label="모집 글 보기" className={styles.tabs}>
          <button
            type="button"
            className={styles.tab}
            aria-pressed={tab === 'post'}
            onClick={() => void setTab('post')}
          >
            모집 글
          </button>
          <button
            type="button"
            className={styles.tab}
            aria-pressed={tab === 'applicants'}
            onClick={() => void setTab('applicants')}
          >
            지원자 {recruit.applicantCount}
            <span className="sr-only">명 검토 대기</span>
          </button>
        </div>
      )}

      {author && tab === 'applicants' ? (
        <ApplicantList recruit={recruit} />
      ) : (
        <PostView recruit={recruit} onShowApplicants={() => void setTab('applicants')} />
      )}

      <RecruitMenuSheet recruit={recruit} />
      {author ? (
        <>
          <ApplicationSheet recruit={recruit} />
          <RejectSheet recruitId={recruitId} />
          <AcceptExceptionSheets recruit={recruit} />
        </>
      ) : (
        <RecruitApplySheet recruit={recruit} />
      )}
    </>
  );
}

function PostView({
  recruit,
  onShowApplicants,
}: {
  recruit: Detail;
  onShowApplicants: () => void;
}) {
  const menu = useOverlay('recruit-menu');
  const days = daysUntil(recruit.deadline);
  const closed = recruit.status === 'CLOSED' || days < 0;

  return (
    <div className={styles.layout}>
      <article aria-labelledby="recruit-title" className={styles.main}>
        <header className={styles.head}>
          <div className={styles.headTop}>
            <ul className={styles.badges} aria-label="모집 요약">
              <li className={closed ? styles.closedBadge : styles.deadlineBadge}>
                {closed ? '모집 마감' : days === 0 ? '오늘 마감' : `D-${days}`}
              </li>
              <li className={styles.badge}>
                {RECRUIT_FORMAT_LABELS[recruit.format]}
                {recruit.region && ` · ${recruit.region}`}
              </li>
              {recruit.goal && (
                <li className={styles.badge}>{RECRUIT_GOAL_LABELS[recruit.goal]}</li>
              )}
            </ul>
            <button type="button" className={styles.iconButton} onClick={() => menu.open()}>
              <MoreHorizontal aria-hidden />
              <span className="sr-only">더보기</span>
            </button>
          </div>
          <h2 id="recruit-title" className={styles.title}>
            {recruit.title}
          </h2>
          <p className={styles.byline}>
            <Image
              src={recruit.author.avatarUrl}
              alt=""
              width={24}
              height={24}
              sizes="24px"
              className={styles.bylineAvatar}
            />
            <Link href={`/user/${recruit.author.login}` as Route} className={styles.bylineName}>
              {recruit.author.name}
            </Link>
            <span aria-hidden>·</span>
            <RelativeTime value={recruit.createdAt} />
          </p>
        </header>

        <section aria-labelledby="recruit-roles" className={styles.section}>
          <h3 id="recruit-roles" className={styles.sectionTitle}>
            모집 역할
          </h3>
          <ul className={styles.roles}>
            {recruit.roles.map((role) => (
              <li key={role.id} className={styles.role}>
                <div className={styles.roleHead}>
                  <span className={styles.roleName}>{role.name}</span>
                  <span className={role.remaining > 0 ? styles.roleLeft : styles.roleFull}>
                    {role.remaining > 0 ? `${role.remaining}명 남음` : '모집 완료'}
                  </span>
                </div>
                {/* The text above carries the numbers; the bar is a picture of the same */}
                <div className={styles.meter} aria-hidden>
                  <span
                    className={styles.meterFill}
                    style={{ width: `${Math.min(100, (role.filled / role.headcount) * 100)}%` }}
                  />
                </div>
                <p className={styles.roleCount}>
                  {role.filled}/{role.headcount}명 함께하는 중
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="recruit-intro" className={styles.section}>
          <h3 id="recruit-intro" className={styles.sectionTitle}>
            소개
          </h3>
          <p className={styles.intro}>{recruit.intro}</p>
        </section>

        <section aria-labelledby="recruit-info" className={styles.section}>
          <h3 id="recruit-info" className={styles.sectionTitle}>
            상세 정보
          </h3>
          <dl className={styles.info}>
            <div className={styles.infoRow}>
              <dt>진행 방식</dt>
              <dd>
                {RECRUIT_FORMAT_LABELS[recruit.format]}
                {recruit.region && ` · ${recruit.region}`}
              </dd>
            </div>
            <div className={styles.infoRow}>
              <dt>모집 마감</dt>
              <dd>
                <time dateTime={recruit.deadline}>{formatDate(recruit.deadline)}</time>
                {closed ? ' · 마감됨' : days === 0 ? ' · 오늘 마감' : ` · ${days}일 남음`}
              </dd>
            </div>
            {recruit.duration && (
              <div className={styles.infoRow}>
                <dt>예상 기간</dt>
                <dd>{recruit.duration}</dd>
              </div>
            )}
            {recruit.goal && (
              <div className={styles.infoRow}>
                <dt>목표</dt>
                <dd>{RECRUIT_GOAL_LABELS[recruit.goal]}</dd>
              </div>
            )}
            <div className={styles.infoRow}>
              <dt>팀</dt>
              <dd>{recruit.teamName ?? '아직 팀을 만들지 않았어요'}</dd>
            </div>
          </dl>
          {recruit.techTags.length > 0 && (
            <ul className={styles.tags} aria-label="기술 스택">
              {recruit.techTags.map((tag) => (
                <li key={tag} className={styles.tag}>
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>

      <aside aria-label="지원과 작성자" className={styles.aside}>
        <ActionPanel recruit={recruit} closed={closed} onShowApplicants={onShowApplicants} />
        <section aria-labelledby="recruit-author" className={styles.authorCard}>
          <h3 id="recruit-author" className={styles.sectionTitle}>
            작성자
          </h3>
          <div className={styles.authorRow}>
            <Image
              src={recruit.authorCard.avatarUrl}
              alt=""
              width={48}
              height={48}
              sizes="48px"
              className={styles.authorAvatar}
            />
            <div className={styles.authorText}>
              <p className={styles.authorName}>{recruit.authorCard.name}</p>
              <p className={styles.authorLogin}>@{recruit.authorCard.login}</p>
            </div>
          </div>
          {recruit.authorCard.bio && <p className={styles.authorBio}>{recruit.authorCard.bio}</p>}
          <Button variant="soft" block asChild>
            <Link href={`/user/${recruit.authorCard.login}` as Route}>프로필 보기</Link>
          </Button>
        </section>
      </aside>
    </div>
  );
}

type ActionPanelProps = { recruit: Detail; closed: boolean; onShowApplicants: () => void };

/**
 * The one thing this viewer can do here (07 TODO 21): apply, see their status, cancel, or (author)
 * jump to applicants. Fixed to the bottom on mobile, inside the aside from desktop.
 */
function ActionPanel({ recruit, closed, onShowApplicants }: ActionPanelProps) {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const client = useQueryClient();
  const applySheet = useOverlay('recruit-apply');
  const confirm = useOverlay('application-cancel');
  const cancel = useMutation({
    mutationFn: cancelApplication,
    onSuccess: async () => {
      confirm.close();
      toast('지원을 취소했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
  });
  const mine = recruit.myApplication;
  const suspended = viewer.status === 'SUSPENDED';

  // Recruiters only read (04 ch. 2)
  if (viewer.role === 'recruiter') return null;

  let content;
  if (recruit.isAuthor) {
    content = (
      <div className={styles.actionRow}>
        <Button variant="outline" asChild>
          <Link href={`/recruits/${recruit.id}/edit` as Route}>수정하기</Link>
        </Button>
        <Button className={styles.actionMain} onClick={onShowApplicants}>
          지원자 {recruit.applicantCount}명 보기
        </Button>
      </div>
    );
  } else if (mine?.status === 'PENDING') {
    const roleName = recruit.roles.find((role) => role.id === mine.roleId)?.name;
    content = (
      <div className={styles.actionRow}>
        <p className={styles.actionStatus}>
          <span className={styles.pendingBadge}>검토 중</span>
          {roleName && <span>지원 역할 {roleName}</span>}
        </p>
        <Button
          variant="danger"
          disabled={cancel.isPending || suspended}
          onClick={() => confirm.open(String(mine.id))}
        >
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
  } else if (recruit.isTeamMember) {
    content = <p className={styles.actionNote}>이미 함께하는 팀이에요</p>;
  } else if (closed) {
    content = <p className={styles.actionNote}>모집이 끝났어요</p>;
  } else {
    content = (
      <Button
        block
        aria-disabled={suspended}
        onClick={() => {
          if (suspended || !requireLogin()) return;
          applySheet.open();
        }}
      >
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
        pending={cancel.isPending}
        onConfirm={() => {
          if (mine?.status === 'PENDING' && String(mine.id) === confirm.id && !suspended)
            cancel.mutate(mine.id);
        }}
      />
    </div>
  );
}
