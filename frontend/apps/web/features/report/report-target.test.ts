import { parseReportTarget, reportTargetId } from './report-target';

describe('reportTargetId / parseReportTarget', () => {
  it('round-trips type and id for the report overlay oid', () => {
    expect(reportTargetId('POST', 12)).toBe('POST:12');
    expect(parseReportTarget('POST:12')).toEqual({ type: 'POST', id: '12' });
  });

  it('rejects missing oid, unknown types, and malformed ids', () => {
    expect(parseReportTarget(null)).toBeNull();
    expect(parseReportTarget('POST')).toBeNull();
    expect(parseReportTarget('UNKNOWN:1')).toBeNull();
  });
});
