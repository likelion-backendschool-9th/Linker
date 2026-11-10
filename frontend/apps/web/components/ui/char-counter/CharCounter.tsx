import styles from './CharCounter.module.css';

type CharCounterProps = {
  id: string;
  /** Characters as the policy counts them (`countChars`) */
  count: number;
  max: number;
  /** Added after the default classes, for a field whose page Figma sizes/positions it differently */
  className?: string;
};

/**
 * "12/40" under a text field (blueprint §6-3). Read out politely only from 90% of the limit,
 * so typing doesn't announce every character; over the limit it also says so in text.
 */
export function CharCounter({ id, count, max, className }: CharCounterProps) {
  const near = count >= max * 0.9;
  const over = count > max;
  const classes = [over ? styles.over : styles.counter, className].filter(Boolean).join(' ');
  return (
    <p id={id} className={classes} aria-live={near ? 'polite' : 'off'}>
      <span className="sr-only">글자 수 </span>
      {count.toLocaleString('ko-KR')}/{max.toLocaleString('ko-KR')}
      {over && ' · 글자 수를 넘었어요'}
    </p>
  );
}
