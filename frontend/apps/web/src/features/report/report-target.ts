/** `reports.target_type` and `reports.reason` (08 ERD; 04 ch. 9 "Reports"). */
export const REPORT_TARGET_TYPES = [
  'USER',
  'POST',
  'COMMENT',
  'RECRUIT_POST',
  'TEAM_MESSAGE',
  'DM_MESSAGE',
  'RECRUITER_AD',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  { value: 'SPAM', label: '스팸·홍보' },
  { value: 'ABUSE', label: '욕설·비방·혐오' },
  { value: 'SEXUAL', label: '음란물·성적 괴롭힘' },
  { value: 'PRIVACY', label: '개인정보 노출' },
  { value: 'PLAGIARISM', label: '표절·무단 도용' },
  { value: 'FAKE_RECRUIT', label: '허위 모집·채용 제안·채용 광고' },
  { value: 'IMPERSONATION', label: '사칭' },
  { value: 'ILLEGAL', label: '불법 행위' },
  { value: 'OTHER', label: '기타' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

/** The report sheet's overlay `oid`: `useOverlay('report').open(reportTargetId('POST', 12))` */
export function reportTargetId(type: ReportTargetType, id: number | string): string {
  return `${type}:${id}`;
}

export function parseReportTarget(
  oid: string | null,
): { type: ReportTargetType; id: string } | null {
  if (!oid) return null;
  const [type, id] = oid.split(':');
  if (!id || !REPORT_TARGET_TYPES.includes(type as ReportTargetType)) return null;
  return { type: type as ReportTargetType, id };
}
