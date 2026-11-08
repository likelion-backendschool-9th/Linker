import { CheckBoldIcon } from '@solar-icons/static/bold/check';

import { Icon } from '@/components/ui/icon/Icon';

import styles from './BenefitList.module.css';

/**
 * Words Figma 28 (288:471, 293:218) sets in Medium inside each benefit line. Server copy that
 * isn't listed here (or changes later) simply shows in one weight.
 */
const EMPHASIS: Record<string, readonly string[]> = {
  '채용 담당자 프로필 조회 알림': ['알림'],
  '게시물 통계 확장 : 유입 경로, README 확장': ['게시물 통계 확장'],
  '피드 저장소 사진 10장으로 확장': ['10장으로 확장'],
  '피드 채용 광고 1건': ['피드 채용 광고 1건'],
  '채용 제안 일 10회에서 일 50회': ['채용 제안', '일 50회'],
};

function emphasize(text: string) {
  const parts: { text: string; strong: boolean }[] = [];
  let rest = text;
  for (const word of EMPHASIS[text] ?? []) {
    const at = rest.indexOf(word);
    if (at < 0) continue;
    if (at > 0) parts.push({ text: rest.slice(0, at), strong: false });
    parts.push({ text: word, strong: true });
    rest = rest.slice(at + word.length);
  }
  if (rest) parts.push({ text: rest, strong: false });
  return parts;
}

/** Figma 28 benefit rows: blue check + one line, a few words in Medium. */
export function BenefitList({ benefits, className }: { benefits: string[]; className?: string }) {
  return (
    <ul className={className ? `${styles.list} ${className}` : styles.list}>
      {benefits.map((benefit) => (
        <li key={benefit} className={styles.item}>
          <span className={styles.check} aria-hidden>
            <Icon svg={CheckBoldIcon} />
          </span>
          <span>
            {emphasize(benefit).map((part, index) =>
              part.strong ? (
                <strong key={index} className={styles.strong}>
                  {part.text}
                </strong>
              ) : (
                part.text
              ),
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
