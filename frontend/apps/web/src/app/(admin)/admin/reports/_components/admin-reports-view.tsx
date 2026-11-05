'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { apiFetch } from '@/lib/api/api-fetch';
import { toast } from '@/stores/toast-store';

import styles from './admin-reports.module.css';

type ReportStatus = 'PENDING' | 'HANDLED' | 'APPEALED';
type ReportTargetType = 'USER' | 'POST' | 'COMMENT' | 'RECRUIT_POST' | 'TEAM_MESSAGE' | 'DIRECT_MESSAGE' | 'RECRUITER_AD';
type ReportAction = 'HIDE' | 'DELETE' | 'DISMISS' | 'RESTORE';
type ReportCase = {
  id: number;
  status: ReportStatus;
  targetType: ReportTargetType;
  targetSummary: string;
  reasons: { reason: string; count: number }[];
  reporterCount: number;
  autoHidden: boolean;
  receivedAt: string;
  overdue: boolean;
  target: { id: number; login: string; name: string; avatarUrl: string; userType: 'DEVELOPER' | 'RECRUITER'; jobStatus: string };
  chatContext: { sender: string; text: string; reported?: boolean }[] | null;
  handledAction: string | null;
};
type ReportList = { items: ReportCase[] };
type Appeal = {
  id: number;
  status: 'PENDING' | 'DECIDED';
  user: { id: number; login: string; name: string; avatarUrl: string; userType: string; jobStatus: string };
  caseId: number;
  reason: string;
  createdAt: string;
  originalHandler: string;
};
type AppealList = { items: Appeal[] };

const STATUSES = ['PENDING', 'HANDLED', 'APPEALED'] as const;
const TARGET_TYPES = ['USER', 'POST', 'COMMENT', 'RECRUIT_POST', 'TEAM_MESSAGE', 'DIRECT_MESSAGE', 'RECRUITER_AD'] as const;
const STATUS_LABEL: Record<ReportStatus, string> = { PENDING: '대기', HANDLED: '처리 완료', APPEALED: '이의 제기' };
const TARGET_LABEL: Record<ReportTargetType, string> = {
  USER: '사용자', POST: '게시물', COMMENT: '댓글', RECRUIT_POST: '팀 모집 글',
  TEAM_MESSAGE: '팀 채팅', DIRECT_MESSAGE: '1:1 채팅', RECRUITER_AD: '채용 광고',
};
const REASON_LABEL: Record<string, string> = {
  SPAM: '스팸', ABUSE: '괴롭힘·혐오', SEXUAL: '성적 콘텐츠', PRIVACY: '개인정보 노출',
  PLAGIARISM: '표절·도용', FAKE_RECRUIT: '허위 모집', IMPERSONATION: '사칭', ILLEGAL: '불법 행위', OTHER: '기타',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

export function AdminReportsView() {
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(['reports', 'appeals'] as const).withDefault('reports'));
  const [status, setStatus] = useQueryState('status', parseAsStringLiteral(STATUSES).withDefault('PENDING'));
  const [targetType, setTargetType] = useQueryState('targetType', parseAsStringLiteral(['ALL', ...TARGET_TYPES] as const).withDefault('ALL'));
  const [overdue, setOverdue] = useQueryState('overdue', parseAsStringLiteral(['true', 'false'] as const).withDefault('false'));
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [sort, setSort] = useQueryState('sort', parseAsStringLiteral(['newest', 'oldest'] as const).withDefault('newest'));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [action, setAction] = useState<ReportAction | null>(null);
  const [reason, setReason] = useState('');
  const [appealId, setAppealId] = useState<number | null>(null);
  const [appealAccept, setAppealAccept] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  const confirm = useOverlay('admin-report-action');

  const listQuery = useQuery({
    queryKey: ['admin-report-cases', status, targetType, overdue],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('status', status);
      if (targetType !== 'ALL') params.set('targetType', targetType);
      if (overdue === 'true') params.set('overdue', 'true');
      return apiFetch<ReportList>(`/api/v1/admin/report-cases?${params.toString()}`);
    },
    enabled: tab === 'reports',
  });
  const detailQuery = useQuery({
    queryKey: ['admin-report-case', selectedId],
    queryFn: () => apiFetch<ReportCase>(`/api/v1/admin/report-cases/${selectedId}`),
    enabled: selectedId !== null && tab === 'reports',
  });
  const appealsQuery = useQuery({
    queryKey: ['admin-appeals'],
    queryFn: () => apiFetch<AppealList>('/api/v1/admin/appeals?status=PENDING'),
    enabled: tab === 'appeals',
  });
  const processReport = useMutation({
    mutationFn: ({ id, nextAction, note }: { id: number; nextAction: ReportAction; note: string }) =>
      apiFetch<ReportCase>(`/api/v1/admin/report-cases/${id}/actions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: nextAction, ...(note.trim() ? { reason: note.trim() } : {}) }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-report-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-report-case', selectedId] });
      toast('신고 처리를 저장했어요.');
      confirm.close(); setAction(null); setReason('');
    },
    onError: (error) => toast(error instanceof Error ? error.message : '신고 처리를 저장하지 못했어요.', { tone: 'alert' }),
  });
  const decideAppeal = useMutation({
    mutationFn: ({ id, accept, note }: { id: number; accept: boolean; note: string }) =>
      apiFetch<void>(`/api/v1/admin/appeals/${id}/decision`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accept, reason: note.trim() }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-appeals'] });
      toast('이의 제기 결정을 저장했어요.');
      confirm.close(); setAppealId(null); setAppealAccept(null); setReason('');
    },
    onError: (error) => toast(error instanceof Error ? error.message : '이의 제기 결정을 저장하지 못했어요.', { tone: 'alert' }),
  });

  const visibleCases = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ko-KR');
    return [...(listQuery.data?.items ?? [])]
      .filter((item) => !needle || `${item.id} ${item.target.name} ${item.target.login} ${item.targetSummary}`.toLocaleLowerCase('ko-KR').includes(needle))
      .sort((left, right) => (sort === 'newest' ? 1 : -1) * (Date.parse(left.receivedAt) - Date.parse(right.receivedAt)));
  }, [listQuery.data?.items, search, sort]);

  const detail = detailQuery.data;
  const currentAppeal = appealsQuery.data?.items.find((item) => item.id === appealId);
  const confirmTitle = appealId !== null ? '이의 제기 결정' : action === 'DISMISS' ? '신고를 기각할까요?' : action === 'RESTORE' ? '처리된 콘텐츠를 복원할까요?' : action === 'DELETE' ? '콘텐츠를 삭제할까요?' : '콘텐츠를 숨길까요?';

  function askAction(nextAction: ReportAction) { setAction(nextAction); confirm.open(); }
  function askAppeal(item: Appeal, accept: boolean) { setAppealId(item.id); setAppealAccept(accept); setReason(''); confirm.open(); }
  function confirmCurrentAction() {
    if (appealId !== null && appealAccept !== null) decideAppeal.mutate({ id: appealId, accept: appealAccept, note: reason });
    else if (selectedId !== null && action) processReport.mutate({ id: selectedId, nextAction: action, note: reason });
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><h1 id="page-title">운영 · 신고 처리</h1><p>접수된 신고를 확인하고 정책에 따라 처리해요.</p></div>
        <div className={styles.count} aria-live="polite">{tab === 'reports' ? `${listQuery.data?.items.length ?? 0}건` : `${appealsQuery.data?.items.length ?? 0}건`}</div>
      </header>

      <div className={styles.tabs} role="group" aria-label="운영 항목">
        <button type="button" aria-pressed={tab === 'reports'} onClick={() => void setTab('reports')}>신고 목록</button>
        <button type="button" aria-pressed={tab === 'appeals'} onClick={() => void setTab('appeals')}>이의 제기</button>
      </div>

      {tab === 'reports' ? (
        <>
          <div className={styles.filters}>
            <label className={styles.searchLabel}>신고 ID 또는 사용자 검색
              <input value={search} onChange={(event) => { void setSearch(event.target.value || null); setSelectedId(null); }} placeholder="ID, 이름, 아이디, 내용" />
            </label>
            <label>처리 상태<select value={status} onChange={(event) => { void setStatus(event.target.value as ReportStatus); setSelectedId(null); }}>
              {STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
            </select></label>
            <label>대상 유형<select value={targetType} onChange={(event) => { void setTargetType(event.target.value as (typeof TARGET_TYPES)[number]); setSelectedId(null); }}>
              <option value="ALL">전체</option>{TARGET_TYPES.map((item) => <option key={item} value={item}>{TARGET_LABEL[item]}</option>)}
            </select></label>
            <label>접수 기한<select value={overdue} onChange={(event) => void setOverdue(event.target.value as 'true' | 'false')}>
              <option value="false">전체</option><option value="true">처리 기한 초과</option>
            </select></label>
            <label>접수일 정렬<select value={sort} onChange={(event) => void setSort(event.target.value as 'newest' | 'oldest')}>
              <option value="newest">최신순</option><option value="oldest">오래된 순</option>
            </select></label>
          </div>
          {listQuery.isPending ? <div className={styles.loading}><Skeleton variant="card" count={4} /></div>
            : listQuery.error ? <ErrorState title="신고 목록을 불러오지 못했어요" description={listQuery.error.message} onRetry={() => void listQuery.refetch()} />
              : visibleCases.length === 0 ? <EmptyState title="확인할 신고가 없어요" description={search ? '검색어를 바꾸거나 필터를 조정해 보세요.' : '조건에 맞는 신고가 접수되면 여기에 표시돼요.'} />
                : <div className={styles.columns}>
                  <div className={styles.list} aria-label="신고 목록">
                    <div className={styles.tableHead}><span>신고</span><span>상태 · 접수일</span></div>
                    {visibleCases.map((item) => <button key={item.id} type="button" className={styles.reportCard} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}>
                      <span className={styles.reportMain}><strong>#{item.id} · {TARGET_LABEL[item.targetType]}</strong><span>{item.targetSummary}</span><span>대상: {item.target.name} (@{item.target.login})</span></span>
                      <span className={styles.reportMeta}><span className={item.overdue ? styles.overdue : styles.badge}>{item.overdue ? '기한 초과' : STATUS_LABEL[item.status]}</span><time dateTime={item.receivedAt}>{formatDate(item.receivedAt)}</time></span>
                    </button>)}
                  </div>
                  <aside className={styles.detail} aria-label="신고 상세">
                    {selectedId === null ? <EmptyState title="신고를 선택해 주세요" description="목록에서 항목을 선택하면 상세 내용이 표시돼요." />
                      : detailQuery.isPending ? <Skeleton variant="card" count={3} />
                        : detailQuery.error ? <ErrorState title="상세 내용을 불러오지 못했어요" description={detailQuery.error.message} onRetry={() => void detailQuery.refetch()} />
                          : detail ? <>
                            <div className={styles.detailHeading}><div><p className={styles.eyebrow}>신고 #{detail.id}</p><h2>{TARGET_LABEL[detail.targetType]} 신고</h2></div><span className={detail.overdue ? styles.overdue : styles.badge}>{detail.overdue ? '처리 기한 초과' : STATUS_LABEL[detail.status]}</span></div>
                            <dl className={styles.detailGrid}>
                              <div><dt>신고 대상</dt><dd>{detail.target.name} (@{detail.target.login})</dd></div>
                              <div><dt>접수일</dt><dd>{formatDate(detail.receivedAt)}</dd></div>
                              <div><dt>신고자 수</dt><dd>{detail.reporterCount}명</dd></div>
                              <div><dt>자동 숨김</dt><dd>{detail.autoHidden ? '적용됨' : '미적용'}</dd></div>
                              {detail.handledAction && <div><dt>처리 내용</dt><dd>{detail.handledAction}</dd></div>}
                            </dl>
                            <section><h3>신고 내용</h3><p className={styles.content}>{detail.targetSummary}</p></section>
                            <section><h3>신고 사유</h3><ul className={styles.reasonList}>{detail.reasons.map((entry) => <li key={entry.reason}>{REASON_LABEL[entry.reason] ?? entry.reason}<span>{entry.count}건</span></li>)}</ul></section>
                            {detail.chatContext?.length ? <section><h3>신고 당시 대화</h3><ol className={styles.chatContext}>{detail.chatContext.map((message, index) => <li key={`${index}-${message.sender}`} className={message.reported ? styles.reportedMessage : undefined}><strong>{message.sender}</strong><p>{message.text}</p></li>)}</ol><p className={styles.note}>신고 접수 시점에 복사된 대화만 표시돼요.</p></section> : null}
                            {detail.status !== 'APPEALED' && <div className={styles.actionSection}>
                              <label>처리 사유{(detail.status === 'PENDING') && <span> (숨김·삭제 시 필수)</span>}<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></label>
                              <div className={styles.actions}>
                                {detail.status === 'PENDING' ? <><Button variant="outline" onClick={() => askAction('HIDE')} disabled={!reason.trim()}>숨기기</Button><Button variant="danger" onClick={() => askAction('DELETE')} disabled={!reason.trim()}>삭제</Button><Button variant="outline" onClick={() => askAction('DISMISS')}>기각</Button></>
                                  : <Button variant="outline" onClick={() => askAction('RESTORE')}>복원</Button>}
                              </div>
                            </div>}
                          </> : null}
                  </aside>
                </div>}
        </>
      ) : (
        appealsQuery.isPending ? <Skeleton variant="card" count={3} />
          : appealsQuery.error ? <ErrorState title="이의 제기를 불러오지 못했어요" description={appealsQuery.error.message} onRetry={() => void appealsQuery.refetch()} />
            : appealsQuery.data?.items.length ? <div className={styles.appeals}>{appealsQuery.data.items.map((item) => <article key={item.id} className={styles.appealCard}>
              <div><p className={styles.eyebrow}>이의 제기 #{item.id} · 신고 #{item.caseId}</p><h2>{item.user.name} (@{item.user.login})</h2><p>{item.reason}</p><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></div>
              <div className={styles.actions}><Button onClick={() => askAppeal(item, true)}>수용</Button><Button variant="outline" onClick={() => askAppeal(item, false)}>기각</Button></div>
            </article>)}</div> : <EmptyState title="검토할 이의 제기가 없어요" description="새 이의 제기가 접수되면 여기에 표시돼요." />
      )}

      <ConfirmDialog overlay={confirm} title={appealId !== null ? `이의 제기를 ${appealAccept ? '수용' : '기각'}할까요?` : confirmTitle}
        description={appealId !== null ? `이의 제기 #${appealId} · 최초 처리자와 다른 운영자만 결정할 수 있어요.` : `신고 #${selectedId}에 이 조치를 적용할까요?`}
        confirmLabel={appealId !== null ? '결정 저장' : action === 'DISMISS' ? '기각' : action === 'RESTORE' ? '복원' : action === 'DELETE' ? '삭제' : '숨기기'}
        destructive={action === 'DELETE'} pending={processReport.isPending || decideAppeal.isPending}
        onConfirm={confirmCurrentAction} />
      {currentAppeal && <span className={styles.srOnly}>최초 처리자 {currentAppeal.originalHandler}</span>}
    </div>
  );
}
