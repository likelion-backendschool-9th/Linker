'use client';

import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import { profileHref } from '@/lib/navigation/collaboration-links';

import type { Offer, OfferCounts, OfferFilter, OffersResponse } from '../../_lib/offer-types';
import { OFFER_FILTERS } from '../../_lib/offer-types';
import styles from '../recruiter-offers.module.css';
import { FILTER_LABELS, STATUS_PILL_LABELS, useRecruiterOffersView } from './hook';

const VISIBLE_TAGS = 4;

export function RecruiterOffersView({
  initialStatus,
  initialOffers,
  initialCounts,
  initialError,
}: {
  initialStatus: OfferFilter;
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
            {OFFER_FILTERS.map((item) => {
              const count = item === 'ALL' ? null : (counts.data?.[item] ?? 0);
              const label = count === null ? FILTER_LABELS[item] : `${FILTER_LABELS[item]} ${count}`;
              return (
                <button
                  className={styles.tab}
                  key={item}
                  type="button"
                  aria-pressed={status === item}
                  onClick={() => void setStatus(item)}
                >
                  {label}
                </button>
              );
            })}
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
              <p>{FILTER_LABELS[status]} 제안이 생기면 여기에 표시돼요.</p>
            </section>
          ) : (
            <ul className={styles.list} aria-label={`${FILTER_LABELS[status]} 채용 제안`}>
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
  const tags = offer.techStack.slice(0, VISIBLE_TAGS);
  const hiddenTags = offer.techStack.length - tags.length;
  const canOpen = Boolean(developer) && !offer.unavailable;

  return (
    <li>
      <article className={styles.card} aria-label={`${visibleName}, ${STATUS_PILL_LABELS[offer.status]}`}>
        <div className={styles.person}>
          <div className={styles.identity}>
            {developer && !offer.unavailable && developer.avatarUrl ? (
              <span className={styles.avatar}>
                <Image src={developer.avatarUrl} alt="" fill sizes="44px" />
              </span>
            ) : (
              <span className={styles.avatar} aria-hidden="true" />
            )}
            <div className={styles.personInfo}>
              {canOpen && developer ? (
                <Link className={styles.personLink} href={profileHref(developer.login)}>
                  {visibleName}
                </Link>
              ) : (
                <span className={styles.personLink}>{visibleName}</span>
              )}
              {canOpen && developer && <span className={styles.handle}>@{developer.login}</span>}
            </div>
          </div>
          <span className={`${styles.status} ${styles[offer.status]}`}>{STATUS_PILL_LABELS[offer.status]}</span>
        </div>

        {tags.length > 0 && (
          <ul className={styles.tags} aria-label="기술 스택">
            {tags.map((tag) => (
              <li className={styles.tag} key={tag}>
                {tag}
              </li>
            ))}
            {hiddenTags > 0 && <li className={styles.tag}>+{hiddenTags}</li>}
          </ul>
        )}

        {canOpen && offer.status === 'TALKING' && (
          <Link className={styles.openChat} href={`/chats/${offer.roomId}` as Route}>
            대화 열기
          </Link>
        )}
        {canOpen && offer.status !== 'TALKING' && (
          <button className={styles.openChat} type="button" onClick={onShowMessage}>
            보낸 메시지 보기
          </button>
        )}
      </article>
    </li>
  );
}
