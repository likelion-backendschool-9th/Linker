/** One decimal, rounded down, without a trailing ".0" (1,250 → "1.2", 1,000 → "1"). */
function oneDecimal(value: number): string {
  return String(Math.floor(value * 10) / 10);
}

/** Under 1,000 as is; "1.2천" from 1,000; "1.2만" from 10,000 (04 ch. 2 "Number display"). */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 10000) return `${oneDecimal(value / 1000)}천`;
  return `${oneDecimal(value / 10000)}만`;
}

export function formatWon(value: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
}
