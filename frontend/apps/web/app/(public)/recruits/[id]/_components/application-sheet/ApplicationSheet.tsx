'use client';

// Overlay: one application with the auto-attached profile, accept / reject (07 TODO 21, POL-R-3/4)
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import type { ApplicationDetail, RecruitDetail } from '../../_lib/detail-queries';
import { AcceptedPanel } from '../accepted-panel';
import styles from '../detail-sheets.module.css';
import { useApplicationBody, useApplicationSheet } from './hook';

/** Open with `useOverlay('recruit-application').open(applicationId)` */
export function ApplicationSheet({ recruit }: { recruit: RecruitDetail }) {
  const overlay = useApplicationSheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title="지원서"
      description="지원자의 프로필과 하고 싶은 말을 보고 수락하거나 거절해 주세요."
    >
      {overlay.isOpen && overlay.id && (
        <ApplicationBody
          key={overlay.id}
          recruit={recruit}
          applicationId={overlay.id}
          overlay={overlay}
        />
      )}
    </OverlaySheet>
  );
}

type ApplicationBodyProps = {
  recruit: RecruitDetail;
  applicationId: string;
  overlay: OverlayControl;
};

function ApplicationBody({ recruit, applicationId, overlay }: ApplicationBodyProps) {
  const {
    application,
    accepted,
    acceptPending,
    acceptError,
    openReject,
    acceptApplication,
    close,
  } = useApplicationBody({ recruit, applicationId, overlay });

  if (application.isPending) return <Skeleton count={3} />;
  if (application.isError) {
    return (
      <ErrorState title="지원서를 불러오지 못했어요" onRetry={() => void application.refetch()} />
    );
  }

  const data = application.data;

  return (
    <div className={styles.body}>
      <ApplicantProfile data={data} />

      {accepted ? (
        <AcceptedPanel
          result={accepted}
          applicantId={data.applicant.id}
          applicantName={data.applicant.name}
        />
      ) : data.status === 'PENDING' ? (
        <>
          {acceptError && (
            <p className={styles.error} role="alert">
              {acceptError}
            </p>
          )}
          <div className={styles.actions}>
            <Button variant="danger" disabled={acceptPending} onClick={openReject}>
              거절
            </Button>
            <Button aria-disabled={acceptPending} onClick={acceptApplication}>
              {acceptPending ? '수락하는 중…' : '수락'}
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.actions}>
          <Button variant="outline" onClick={close}>
            닫기
          </Button>
        </div>
      )}
    </div>
  );
}

/** The profile attached to every application (POL-R-3): stack, graph, completion record, posts */
function ApplicantProfile({ data }: { data: ApplicationDetail }) {
  const total = data.contributions.reduce((sum, day) => sum + day.count, 0);
  return (
    <>
      <div className={styles.applicant}>
        <Image
          src={data.applicant.avatarUrl}
          alt=""
          width={48}
          height={48}
          sizes="48px"
          className={styles.avatar}
        />
        <div className={styles.applicantText}>
          <p className={styles.applicantName}>{data.applicant.name}</p>
          <p className={styles.meta}>
            @{data.applicant.login} · <RelativeTime value={data.appliedAt} /> 지원
          </p>
        </div>
      </div>

      <section aria-labelledby="application-message" className={styles.block}>
        <h3 id="application-message" className={styles.blockTitle}>
          하고 싶은 말
        </h3>
        <p className={styles.message}>{data.message || '남긴 말이 없어요.'}</p>
      </section>

      <section aria-labelledby="application-stack" className={styles.block}>
        <h3 id="application-stack" className={styles.blockTitle}>
          기술 스택
        </h3>
        {data.techStack.length > 0 ? (
          <ul className={styles.tags}>
            {data.techStack.map((tag) => (
              <li key={tag} className={styles.tag}>
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>등록한 기술 스택이 없어요.</p>
        )}
      </section>

      <section aria-labelledby="application-record" className={styles.block}>
        <h3 id="application-record" className={styles.blockTitle}>
          완주 기록
        </h3>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>완주한 프로젝트</dt>
            <dd>{data.completion.projectCount}개</dd>
          </div>
          <div className={styles.stat}>
            <dt>이슈 완료율</dt>
            <dd>{Math.round(data.completion.issueCompletionRate * 100)}%</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="application-graph" className={styles.block}>
        <h3 id="application-graph" className={styles.blockTitle}>
          이번 달 기여
        </h3>
        <p className={styles.hint}>
          {data.contributions.length}일 동안 {total}회 기여했어요.
        </p>
        {/* The sentence above is the data; the cells only picture it */}
        <ol className={styles.graph} aria-hidden>
          {data.contributions.map((day) => (
            <li
              key={day.date}
              className={styles.cell}
              data-level={day.count === 0 ? 0 : day.count < 3 ? 1 : day.count < 6 ? 2 : 3}
            />
          ))}
        </ol>
      </section>

      <section aria-labelledby="application-posts" className={styles.block}>
        <h3 id="application-posts" className={styles.blockTitle}>
          게시물
        </h3>
        {data.posts.length > 0 ? (
          <ul className={styles.posts}>
            {data.posts.slice(0, 3).map((item) => (
              <li key={item.id}>
                <Link href={`/posts/${item.id}` as Route} className={styles.post}>
                  <span className={styles.postIntro}>{item.intro}</span>
                  <span className={styles.meta}>{item.repoFullName}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>아직 올린 게시물이 없어요.</p>
        )}
      </section>

      <Button variant="soft" block asChild>
        <Link href={`/user/${data.applicant.login}` as Route}>프로필 전체 보기</Link>
      </Button>
    </>
  );
}
