'use client';

import Image from 'next/image';
import Link from 'next/link';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';

import type { Offer, OfferCounts, OfferStatus, OffersResponse } from '../../_lib/offer-types';
import { OFFER_STATUSES } from '../../_lib/offer-types';
import styles from '../recruiter-offers.module.css';
import { STATUS_LABELS, useRecruiterOffersView } from './hook';

export function RecruiterOffersView({
  initialStatus,
  initialOffers,
  initialCounts,
  initialError,
}: {
  initialStatus: OfferStatus;
  initialOffers: OffersResponse | null;
  initialCounts: OfferCounts | null;
  initialError: string | null;
}) {
  const {
    status,
    setStatus,
    messageSheet,
    offers,
    counts,
    firstMessage,
    sortedOffers,
    total,
    listError,
    countsError,
    handlers,
  } = useRecruiterOffersView({
    initialStatus,
    initialOffers,
    initialCounts,
    initialError,
  });

  return (
    <div className={styles.page}>
      <p className={styles.intro}>보낸 제안의 응답 상태와 첫 메시지를 확인할 수 있어요.</p>
      {listError || countsError ? (
        <section className={styles.error} role="alert" aria-labelledby="offers-error-title">
          <h2 id="offers-error-title">채용 제안을 불러오지 못했어요</h2>
          <p className={styles.errorText}>{listError ?? countsError}</p>
          {initialError ? (
            <Button variant="outline" onClick={handlers.reloadPage}>
              다시 시도
            </Button>
          ) : (
            <Button variant="outline" onClick={handlers.retryList}>
              다시 시도
            </Button>
          )}
        </section>
      ) : (
        <>
          <nav className={styles.tabs} aria-label="채용 제안 상태">
            {OFFER_STATUSES.map((item) => (
              <button
                className={styles.tab}
                key={item}
                type="button"
                aria-pressed={status === item}
                onClick={() => void setStatus(item)}
              >
                <span className={styles.tabLabel}>{STATUS_LABELS[item]}</span>
                <span className={styles.count} aria-label={`${counts.data?.[item] ?? 0}건`}>
                  {counts.data?.[item] ?? 0}
                </span>
              </button>
            ))}
          </nav>

          {offers.isPending ? (
            <section className={styles.loading} role="status" aria-live="polite">
              목록을 불러오는 중이에요.
            </section>
          ) : total === 0 ? (
            <section className={styles.empty} aria-labelledby="offers-empty-title">
              <h2 id="offers-empty-title">아직 보낸 채용 제안이 없어요</h2>
              <p>피드에서 제안할 개발자를 찾아보세요.</p>
              <Button asChild variant="outline">
                <Link href="/feed">피드 둘러보기</Link>
              </Button>
            </section>
          ) : sortedOffers.length === 0 ? (
            <section className={styles.empty} aria-labelledby="offers-filter-empty-title">
              <h2 id="offers-filter-empty-title">이 상태의 채용 제안이 없어요</h2>
              <p>{STATUS_LABELS[status]} 제안이 생기면 여기에 표시돼요.</p>
            </section>
          ) : (
            <ul className={styles.list} aria-label={`${STATUS_LABELS[status]} 채용 제안`}>
              {sortedOffers.map((offer) => (
                <OfferCard
                  key={offer.roomId}
                  offer={offer}
                  onShowMessage={() => handlers.showMessage(offer.roomId)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <OverlaySheet
        overlay={messageSheet}
        title="보낸 메시지"
        description="채용 제안에서 처음 보낸 메시지예요."
      >
        <div className={styles.sheetContent}>
          {firstMessage.isPending ? (
            <p className={styles.loading} role="status">
              메시지를 불러오는 중이에요.
            </p>
          ) : firstMessage.isError ? (
            <div className={styles.error} role="alert">
              <p className={styles.errorText}>
                {firstMessage.error instanceof Error
                  ? firstMessage.error.message
                  : '메시지를 불러오지 못했어요.'}
              </p>
              <Button variant="outline" onClick={() => void firstMessage.refetch()}>
                다시 시도
              </Button>
            </div>
          ) : firstMessage.data ? (
            <>
              <p className={styles.sheetMessage}>
                {firstMessage.data.text || '메시지 내용을 확인할 수 없어요.'}
              </p>
              {firstMessage.data.sentAt && (
                <p className={styles.meta}>
                  <RelativeTime value={firstMessage.data.sentAt} />
                </p>
              )}
            </>
          ) : null}
        </div>
      </OverlaySheet>
    </div>
  );
}

function OfferCard({ offer, onShowMessage }: { offer: Offer; onShowMessage: () => void }) {
  const developer = offer.developer;
  const visibleName = offer.unavailable || !developer ? '볼 수 없는 사용자' : developer.name;
  const jobStatus =
    developer?.jobStatus === 'SEEKING'
      ? '구직 중'
      : developer?.jobStatus === 'OPEN'
        ? '제안만 받기'
        : null;

  return (
    <li>
      <article className={styles.card} aria-label={`${visibleName}, ${STATUS_LABELS[offer.status]}`}>
        <div className={styles.cardMain}>
          <div className={styles.person}>
            {developer && !offer.unavailable && developer.avatarUrl ? (
              <span className={styles.avatar}>
                <Image src={developer.avatarUrl} alt="" fill sizes="48px" />
              </span>
            ) : (
              <span className={styles.avatar} aria-hidden="true" />
            )}
            <div className={styles.personInfo}>
              {developer && !offer.unavailable ? (
                <Link
                  className={styles.personLink}
                  href={`/users/${encodeURIComponent(developer.login)}`}
                >
                  {visibleName}
                </Link>
              ) : (
                <span className={styles.personLink}>{visibleName}</span>
              )}
              {developer && !offer.unavailable && (
                <span className={styles.handle}>@{developer.login}</span>
              )}
            </div>
          </div>

          <div className={styles.statusLine}>
            <span className={styles.status}>{STATUS_LABELS[offer.status]}</span>
            {jobStatus && <span className={styles.badge}>{jobStatus}</span>}
            <span className={styles.meta}>
              <RelativeTime value={offer.sentAt} />
            </span>
          </div>

          {offer.techStack.length > 0 && (
            <ul className={styles.tags} aria-label="기술 스택">
              {offer.techStack.slice(0, 3).map((tag) => (
                <li className={styles.tag} key={tag}>
                  {tag}
                </li>
              ))}
            </ul>
          )}

          <p className={styles.messagePreview}>{offer.firstMessage}</p>
        </div>

        <div className={styles.actions}>
          {offer.status === 'TALKING' && developer && !offer.unavailable ? (
            <Button disabled aria-describedby={`chat-pending-${offer.roomId}`}>
              대화 열기
            </Button>
          ) : offer.status !== 'TALKING' ? (
            <Button variant="outline" onClick={onShowMessage}>
              보낸 메시지 보기
            </Button>
          ) : null}
        </div>
        {offer.status === 'TALKING' && developer && !offer.unavailable && (
          <p className={styles.meta} id={`chat-pending-${offer.roomId}`}>
            채팅 화면(Page 17)이 준비되면 대화로 이동할 수 있어요.
          </p>
        )}
      </article>
    </li>
  );
}
