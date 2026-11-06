'use client';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from '../admin-reports.module.css';
import {
  formatReportDate,
  REASON_LABEL,
  STATUS_LABEL,
  STATUSES,
  TARGET_LABEL,
  TARGET_TYPES,
  useAdminReportsView,
} from './hook';
import type { ReportStatus } from './api';

export function AdminReportsView() {
  const {
    tab,
    setTab,
    status,
    targetType,
    overdue,
    setOverdue,
    search,
    sort,
    setSort,
    selectedId,
    setSelectedId,
    action,
    reason,
    setReason,
    appealId,
    appealAccept,
    confirm,
    listQuery,
    detailQuery,
    appealsQuery,
    processReport,
    decideAppeal,
    visibleCases,
    detail,
    currentAppeal,
    confirmTitle,
    handlers,
  } = useAdminReportsView();

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <h1 id="page-title">운영 · 신고 처리</h1>
          <p>접수된 신고를 확인하고 정책에 따라 처리해요.</p>
        </div>
        <div className={styles.count} aria-live="polite">
          {tab === 'reports'
            ? `${listQuery.data?.items.length ?? 0}건`
            : `${appealsQuery.data?.items.length ?? 0}건`}
        </div>
      </header>

      <div className={styles.tabs} role="group" aria-label="운영 항목">
        <button type="button" aria-pressed={tab === 'reports'} onClick={() => void setTab('reports')}>
          신고 목록
        </button>
        <button type="button" aria-pressed={tab === 'appeals'} onClick={() => void setTab('appeals')}>
          이의 제기
        </button>
      </div>

      {tab === 'reports' ? (
        <>
          <div className={styles.filters}>
            <label className={styles.searchLabel}>
              신고 ID 또는 사용자 검색
              <input
                value={search}
                onChange={(event) => handlers.onSearchChange(event.target.value)}
                placeholder="ID, 이름, 아이디, 내용"
              />
            </label>
            <label>
              처리 상태
              <select
                value={status}
                onChange={(event) => handlers.onStatusChange(event.target.value as ReportStatus)}
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {STATUS_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              대상 유형
              <select
                value={targetType}
                onChange={(event) =>
                  handlers.onTargetTypeChange(
                    event.target.value as (typeof TARGET_TYPES)[number] | 'ALL',
                  )
                }
              >
                <option value="ALL">전체</option>
                {TARGET_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {TARGET_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              접수 기한
              <select
                value={overdue}
                onChange={(event) => void setOverdue(event.target.value as 'true' | 'false')}
              >
                <option value="false">전체</option>
                <option value="true">처리 기한 초과</option>
              </select>
            </label>
            <label>
              접수일 정렬
              <select
                value={sort}
                onChange={(event) => void setSort(event.target.value as 'newest' | 'oldest')}
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된 순</option>
              </select>
            </label>
          </div>
          {listQuery.isPending ? (
            <div className={styles.loading}>
              <Skeleton variant="card" count={4} />
            </div>
          ) : listQuery.error ? (
            <ErrorState
              title="신고 목록을 불러오지 못했어요"
              description={listQuery.error.message}
              onRetry={() => void listQuery.refetch()}
            />
          ) : visibleCases.length === 0 ? (
            <EmptyState
              title="확인할 신고가 없어요"
              description={
                search
                  ? '검색어를 바꾸거나 필터를 조정해 보세요.'
                  : '조건에 맞는 신고가 접수되면 여기에 표시돼요.'
              }
            />
          ) : (
            <div className={styles.columns}>
              <div className={styles.list} aria-label="신고 목록">
                <div className={styles.tableHead}>
                  <span>신고</span>
                  <span>상태 · 접수일</span>
                </div>
                {visibleCases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.reportCard}
                    aria-pressed={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className={styles.reportMain}>
                      <strong>
                        #{item.id} · {TARGET_LABEL[item.targetType]}
                      </strong>
                      <span>{item.targetSummary}</span>
                      <span>
                        대상: {item.target.name} (@{item.target.login})
                      </span>
                    </span>
                    <span className={styles.reportMeta}>
                      <span className={item.overdue ? styles.overdue : styles.badge}>
                        {item.overdue ? '기한 초과' : STATUS_LABEL[item.status]}
                      </span>
                      <time dateTime={item.receivedAt}>{formatReportDate(item.receivedAt)}</time>
                    </span>
                  </button>
                ))}
              </div>
              <aside className={styles.detail} aria-label="신고 상세">
                {selectedId === null ? (
                  <EmptyState
                    title="신고를 선택해 주세요"
                    description="목록에서 항목을 선택하면 상세 내용이 표시돼요."
                  />
                ) : detailQuery.isPending ? (
                  <Skeleton variant="card" count={3} />
                ) : detailQuery.error ? (
                  <ErrorState
                    title="상세 내용을 불러오지 못했어요"
                    description={detailQuery.error.message}
                    onRetry={() => void detailQuery.refetch()}
                  />
                ) : detail ? (
                  <>
                    <div className={styles.detailHeading}>
                      <div>
                        <p className={styles.eyebrow}>신고 #{detail.id}</p>
                        <h2>{TARGET_LABEL[detail.targetType]} 신고</h2>
                      </div>
                      <span className={detail.overdue ? styles.overdue : styles.badge}>
                        {detail.overdue ? '처리 기한 초과' : STATUS_LABEL[detail.status]}
                      </span>
                    </div>
                    <dl className={styles.detailGrid}>
                      <div>
                        <dt>신고 대상</dt>
                        <dd>
                          {detail.target.name} (@{detail.target.login})
                        </dd>
                      </div>
                      <div>
                        <dt>접수일</dt>
                        <dd>{formatReportDate(detail.receivedAt)}</dd>
                      </div>
                      <div>
                        <dt>신고자 수</dt>
                        <dd>{detail.reporterCount}명</dd>
                      </div>
                      <div>
                        <dt>자동 숨김</dt>
                        <dd>{detail.autoHidden ? '적용됨' : '미적용'}</dd>
                      </div>
                      {detail.handledAction && (
                        <div>
                          <dt>처리 내용</dt>
                          <dd>{detail.handledAction}</dd>
                        </div>
                      )}
                    </dl>
                    <section>
                      <h3>신고 내용</h3>
                      <p className={styles.content}>{detail.targetSummary}</p>
                    </section>
                    <section>
                      <h3>신고 사유</h3>
                      <ul className={styles.reasonList}>
                        {detail.reasons.map((entry) => (
                          <li key={entry.reason}>
                            {REASON_LABEL[entry.reason] ?? entry.reason}
                            <span>{entry.count}건</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                    {detail.chatContext?.length ? (
                      <section>
                        <h3>신고 당시 대화</h3>
                        <ol className={styles.chatContext}>
                          {detail.chatContext.map((message, index) => (
                            <li
                              key={`${index}-${message.sender}`}
                              className={message.reported ? styles.reportedMessage : undefined}
                            >
                              <strong>{message.sender}</strong>
                              <p>{message.text}</p>
                            </li>
                          ))}
                        </ol>
                        <p className={styles.note}>신고 접수 시점에 복사된 대화만 표시돼요.</p>
                      </section>
                    ) : null}
                    {detail.status !== 'APPEALED' && (
                      <div className={styles.actionSection}>
                        <label>
                          처리 사유
                          {detail.status === 'PENDING' && <span> (숨김·삭제 시 필수)</span>}
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                          />
                        </label>
                        <div className={styles.actions}>
                          {detail.status === 'PENDING' ? (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => handlers.askAction('HIDE')}
                                disabled={!reason.trim()}
                              >
                                숨기기
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() => handlers.askAction('DELETE')}
                                disabled={!reason.trim()}
                              >
                                삭제
                              </Button>
                              <Button variant="outline" onClick={() => handlers.askAction('DISMISS')}>
                                기각
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" onClick={() => handlers.askAction('RESTORE')}>
                              복원
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </aside>
            </div>
          )}
        </>
      ) : appealsQuery.isPending ? (
        <Skeleton variant="card" count={3} />
      ) : appealsQuery.error ? (
        <ErrorState
          title="이의 제기를 불러오지 못했어요"
          description={appealsQuery.error.message}
          onRetry={() => void appealsQuery.refetch()}
        />
      ) : appealsQuery.data?.items.length ? (
        <div className={styles.appeals}>
          {appealsQuery.data.items.map((item) => (
            <article key={item.id} className={styles.appealCard}>
              <div>
                <p className={styles.eyebrow}>
                  이의 제기 #{item.id} · 신고 #{item.caseId}
                </p>
                <h2>
                  {item.user.name} (@{item.user.login})
                </h2>
                <p>{item.reason}</p>
                <time dateTime={item.createdAt}>{formatReportDate(item.createdAt)}</time>
              </div>
              <div className={styles.actions}>
                <Button onClick={() => handlers.askAppeal(item, true)}>수용</Button>
                <Button variant="outline" onClick={() => handlers.askAppeal(item, false)}>
                  기각
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="검토할 이의 제기가 없어요"
          description="새 이의 제기가 접수되면 여기에 표시돼요."
        />
      )}

      <ConfirmDialog
        overlay={confirm}
        title={
          appealId !== null
            ? `이의 제기를 ${appealAccept ? '수용' : '기각'}할까요?`
            : confirmTitle
        }
        description={
          appealId !== null
            ? `이의 제기 #${appealId} · 최초 처리자와 다른 운영자만 결정할 수 있어요.`
            : `신고 #${selectedId}에 이 조치를 적용할까요?`
        }
        confirmLabel={
          appealId !== null
            ? '결정 저장'
            : action === 'DISMISS'
              ? '기각'
              : action === 'RESTORE'
                ? '복원'
                : action === 'DELETE'
                  ? '삭제'
                  : '숨기기'
        }
        destructive={action === 'DELETE'}
        pending={processReport.isPending || decideAppeal.isPending}
        onConfirm={handlers.confirmCurrentAction}
      />
      {currentAppeal && (
        <span className={styles.srOnly}>최초 처리자 {currentAppeal.originalHandler}</span>
      )}
    </div>
  );
}
