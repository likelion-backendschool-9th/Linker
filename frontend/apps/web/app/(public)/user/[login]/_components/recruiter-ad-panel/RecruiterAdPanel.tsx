'use client';

import { addDays, format } from 'date-fns';
import Link from 'next/link';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { formatDate, toKst } from '@/lib/format/time';
import { JOB_AD } from '@/lib/policy';

import type { JobAd, SaveMyJobAdBody } from './api';
import { useRecruiterAdPanel } from './hook';
import styles from './RecruiterAdPanel.module.css';

const STATUS_LABEL = {
  ACTIVE: '노출 중',
  PAUSED: '꺼짐',
  ENDED: '마감',
  HIDDEN: '숨김',
} as const;

export function RecruiterAdPanel() {
  const { ad, categories, sheet, error, save, toggle } = useRecruiterAdPanel();

  if (ad.isPending) {
    return <p role="status">채용 광고를 불러오고 있어요.</p>;
  }
  if (!ad.data) return null;

  const current = ad.data.ad;
  const categoryLabel =
    categories.data?.find((item) => item.key === current?.jobCategory)?.label ?? current?.jobCategory;

  return (
    <section className={styles.panel} aria-labelledby="recruiter-ad-title">
      <h2 id="recruiter-ad-title">채용 광고</h2>
      {!ad.data.subscribed && (
        <div className={styles.prompt}>
          <p>Scout를 구독하면 관심 직군이 맞는 개발자의 피드에 채용 광고를 띄울 수 있어요.</p>
          <Button asChild variant="outline">
            <Link href="/subscribe">Scout 알아보기</Link>
          </Button>
        </div>
      )}
      {ad.data.subscribed && !current && (
        <Button type="button" onClick={() => sheet.open()}>
          등록
        </Button>
      )}
      {current && (
        <article className={styles.card}>
          <p>
            {STATUS_LABEL[current.status]} · {current.title}
          </p>
          <p className={styles.meta}>
            {categoryLabel} · <time dateTime={current.closesOn}>{formatDate(current.closesOn)}</time> 마감
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.switch}
              aria-pressed={current.status === 'ACTIVE'}
              disabled={current.status === 'ENDED' || current.status === 'HIDDEN' || toggle.isPending}
              onClick={() => toggle.mutate({ status: current.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
            >
              {current.status === 'ACTIVE' ? '켜짐' : '꺼짐'}
            </button>
            <Button type="button" variant="outline" onClick={() => sheet.open()} disabled={!ad.data.subscribed}>
              수정
            </Button>
          </div>
        </article>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <OverlaySheet overlay={sheet} title={current ? '채용 광고 수정' : '채용 광고 등록'} description="직군, 제목, 공고 주소, 마감일을 입력해요.">
        <AdForm
          categories={categories.data ?? []}
          initial={current}
          pending={save.isPending}
          onSubmit={(body) => save.mutate(body)}
        />
      </OverlaySheet>
    </section>
  );
}

function AdForm({
  categories,
  initial,
  pending,
  onSubmit,
}: {
  categories: { key: string; label: string }[];
  initial: JobAd | null;
  pending: boolean;
  onSubmit: (body: SaveMyJobAdBody) => void;
}) {
  const today = format(toKst(new Date()), 'yyyy-MM-dd');
  const latest = format(addDays(toKst(new Date()), JOB_AD.closesWithinDays), 'yyyy-MM-dd');

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit({
          jobCategory: String(data.get('jobCategory') ?? ''),
          title: String(data.get('title') ?? ''),
          url: String(data.get('url') ?? ''),
          closesOn: String(data.get('closesOn') ?? ''),
        });
      }}
    >
      <label>
        직군
        <select name="jobCategory" defaultValue={initial?.jobCategory ?? categories[0]?.key ?? ''} required>
          {categories.map((category) => (
            <option key={category.key} value={category.key}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        공고 제목
        <input name="title" defaultValue={initial?.title ?? ''} minLength={JOB_AD.title.min} maxLength={JOB_AD.title.max} required />
      </label>
      <label>
        공고 주소
        <input name="url" type="url" defaultValue={initial?.url ?? ''} required />
      </label>
      <label>
        마감일
        <input name="closesOn" type="date" defaultValue={initial?.closesOn ?? today} min={today} max={latest} required />
      </label>
      <Button type="submit" disabled={pending}>
        저장
      </Button>
    </form>
  );
}
