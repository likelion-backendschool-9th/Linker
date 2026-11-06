package com.linker.backend.repository.issue;

import com.linker.backend.dto.issue.response.IssuePersistenceView.CreationJob;
import com.linker.backend.dto.issue.response.IssuePersistenceView.EditJob;
import com.linker.backend.entity.issue.IssueSyncJob;
import com.linker.backend.entity.issue.type.IssueSyncJobStatus;
import com.linker.backend.entity.issue.type.IssueSyncStatus;
import com.linker.backend.entity.issue.type.IssueSyncStep;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

/** Spring Data fragment. No component annotation: IssueSyncJobRepository attaches it by name. */
public class IssueSyncJobRepositoryImpl implements IssueSyncJobRepositoryCustom {
  private static final int DUE_BATCH = 100;

  private final EntityManager entityManager;

  public IssueSyncJobRepositoryImpl(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  // ---------------------------------------------------------------- page 12 edits

  @Override
  @Transactional
  public long queueEdit(long issue, long actor, String step, String payload, Instant now) {
    boolean busy =
        entityManager
                .createQuery(
                    "select count(j) from IssueSyncJob j where j.issueId = :id"
                        + " and j.status in ('PENDING', 'RUNNING')",
                    Long.class)
                .setParameter("id", issue)
                .getSingleResult()
            > 0;
    if (busy)
      throw new ApiException(409, "STATE_CONFLICT", "이전 변경을 GitHub에 반영하고 있어요. 잠시 후 다시 시도해 주세요");
    var job = IssueSyncJob.edit(issue, actor, IssueSyncStep.valueOf(step), payload, now);
    entityManager.persist(job);
    entityManager.flush();
    long id = job.getId();
    markIssue(issue, IssueSyncStatus.PENDING);
    return id;
  }

  @Override
  public EditJob edit(long id) {
    Object[] r =
        entityManager
            .createQuery(
                "select j.id, i.teamId, j.issueId, j.requestedBy, j.step, j.payload, j.status,"
                    + " j.attempts, j.nextRetryAt from IssueSyncJob j, Issue i"
                    + " where i.id = j.issueId and j.id = :id",
                Object[].class)
            .setParameter("id", id)
            .getSingleResult();
    return new EditJob(
        (Long) r[0],
        (Long) r[1],
        (Long) r[2],
        (Long) r[3],
        ((IssueSyncStep) r[4]).name(),
        (String) r[5],
        ((IssueSyncJobStatus) r[6]).name(),
        (Integer) r[7],
        (Instant) r[8]);
  }

  @Override
  public List<Long> dueEdits(Instant now) {
    return due("j.step <> 'CREATE'", now);
  }

  @Override
  @Transactional
  public void startEdit(long id, Instant leaseEnd) {
    bulk(
        entityManager
            .createQuery(
                "update IssueSyncJob j set j.status = :running, j.attempts = j.attempts + 1,"
                    + " j.nextRetryAt = :lease where j.id = :id")
            .setParameter("running", IssueSyncJobStatus.RUNNING)
            .setParameter("lease", leaseEnd)
            .setParameter("id", id));
  }

  @Override
  @Transactional
  public void finishEdit(long id, long issue) {
    bulk(
        entityManager
            .createQuery(
                "update IssueSyncJob j set j.status = :done, j.lastError = null where j.id = :id")
            .setParameter("done", IssueSyncJobStatus.DONE)
            .setParameter("id", id));
    markIssue(issue, IssueSyncStatus.SYNCED);
  }

  @Override
  @Transactional
  public void failEdit(long id, long issue, boolean terminal, String error, Instant retryAt) {
    if (fail(id, terminal, error, retryAt) == 1) markIssue(issue, IssueSyncStatus.FAILED);
  }

  // ---------------------------------------------------------------- page 13 creation intents

  @Override
  public CreationJob creation(long id) {
    return creations("j.id = :id")
        .setParameter("id", id)
        .getResultList()
        .stream()
        .findFirst()
        .map(IssueSyncJobRepositoryImpl::creation)
        .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "생성 작업을 찾을 수 없어요"));
  }

  @Override
  public CreationJob existingCreation(long actor, UUID key) {
    return creations("j.requestedBy = :actor and j.requestKey = :key")
        .setParameter("actor", actor)
        .setParameter("key", key)
        .getResultList()
        .stream()
        .findFirst()
        .map(IssueSyncJobRepositoryImpl::creation)
        .orElse(null);
  }

  @Override
  @Transactional
  public long queueCreation(long team, long actor, UUID key, String payload, Instant now) {
    // pg_advisory_xact_lock is PostgreSQL-only: serializes this author's quota check and insert
    // across teams and instances until the surrounding transaction ends.
    entityManager
        .createNativeQuery("select 1 from pg_advisory_xact_lock(hashtextextended(:key,0))")
        .setParameter("key", "linker:create-author:" + actor)
        .getSingleResult();
    CreationJob prior = existingCreation(actor, key);
    if (prior != null) return prior.id();
    Instant start =
        now.atZone(PlanLimits.APP_ZONE).toLocalDate().atStartOfDay(PlanLimits.APP_ZONE).toInstant();
    long count =
        entityManager
            .createQuery(
                "select count(j) from IssueSyncJob j where j.step = 'CREATE'"
                    + " and j.requestedBy = :actor and j.createdAt >= :start and j.createdAt < :end",
                Long.class)
            .setParameter("actor", actor)
            .setParameter("start", start)
            .setParameter("end", start.plusSeconds(86400))
            .getSingleResult();
    if (count >= PlanLimits.ISSUE_CREATES_PER_DAY)
      throw new ApiException(429, "RATE_LIMITED", "오늘 만들 수 있는 이슈 수를 모두 사용했어요");
    var job = IssueSyncJob.create(team, actor, key, payload, now);
    entityManager.persist(job);
    entityManager.flush();
    return job.getId();
  }

  @Override
  public List<Long> dueCreations(Instant now) {
    return due("j.step = 'CREATE'", now);
  }

  @Override
  @Transactional
  public void startCreation(long id, Instant lease) {
    bulk(
        entityManager
            .createQuery(
                "update IssueSyncJob j set j.status = :running, j.attempts = j.attempts + 1,"
                    + " j.nextRetryAt = :lease where j.id = :id and j.status in ('PENDING', 'RUNNING')")
            .setParameter("running", IssueSyncJobStatus.RUNNING)
            .setParameter("lease", lease)
            .setParameter("id", id));
  }

  @Override
  @Transactional
  public void checkpointCreation(long id, String payload, Long issue) {
    // Loaded and changed as an Entity so the jsonb payload uses the mapped JSON type.
    entityManager.flush();
    entityManager.clear();
    var job = entityManager.find(IssueSyncJob.class, id);
    if (job == null) return;
    job.checkpoint(payload, issue);
    entityManager.flush();
  }

  @Override
  @Transactional
  public void finishCreation(long id, long issue) {
    bulk(
        entityManager
            .createQuery(
                "update IssueSyncJob j set j.status = :done, j.lastError = null, j.issueId = :issue"
                    + " where j.id = :id")
            .setParameter("done", IssueSyncJobStatus.DONE)
            .setParameter("issue", issue)
            .setParameter("id", id));
    markIssue(issue, IssueSyncStatus.SYNCED);
  }

  @Override
  @Transactional
  public void failCreation(long id, boolean terminal, String error, Instant next) {
    fail(id, terminal, error, next);
    bulk(
        entityManager
            .createQuery(
                "update Issue i set i.syncStatus = :failed where i.id = (select j.issueId"
                    + " from IssueSyncJob j where j.id = :id and j.status <> 'DONE')")
            .setParameter("failed", IssueSyncStatus.FAILED)
            .setParameter("id", id));
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Scalar projection, never a managed entity: services re-read a job after another transaction
   * changed it, and a reused persistence context would return the old state.
   */
  private jakarta.persistence.TypedQuery<Object[]> creations(String condition) {
    return entityManager.createQuery(
        "select j.id, j.teamId, j.requestedBy, j.issueId, j.payload, j.status, j.attempts,"
            + " j.nextRetryAt, j.createdAt, j.lastError from IssueSyncJob j"
            + " where j.step = 'CREATE' and "
            + condition,
        Object[].class);
  }

  private static CreationJob creation(Object[] r) {
    return new CreationJob(
        (Long) r[0],
        (Long) r[1],
        (Long) r[2],
        (Long) r[3],
        (String) r[4],
        ((IssueSyncJobStatus) r[5]).name(),
        (Integer) r[6],
        (Instant) r[7],
        (Instant) r[8],
        (String) r[9]);
  }

  private List<Long> due(String step, Instant now) {
    return entityManager
        .createQuery(
            "select j.id from IssueSyncJob j where "
                + step
                + " and j.status in ('PENDING', 'RUNNING') and j.nextRetryAt <= :now"
                + " order by j.nextRetryAt, j.id",
            Long.class)
        .setParameter("now", now)
        .setMaxResults(DUE_BATCH)
        .getResultList();
  }

  /** Retry or stop a job that has not finished; returns the changed row count. */
  private int fail(long id, boolean terminal, String error, Instant retryAt) {
    return bulk(
        entityManager
            .createQuery(
                "update IssueSyncJob j set j.status = :status, j.lastError = :error,"
                    + " j.nextRetryAt = :retry where j.id = :id and j.status <> 'DONE'")
            .setParameter("status", terminal ? IssueSyncJobStatus.FAILED : IssueSyncJobStatus.PENDING)
            .setParameter("error", error)
            .setParameter("retry", retryAt)
            .setParameter("id", id));
  }

  private void markIssue(long issue, IssueSyncStatus status) {
    bulk(
        entityManager
            .createQuery("update Issue i set i.syncStatus = :status where i.id = :id")
            .setParameter("status", status)
            .setParameter("id", issue));
  }

  private int bulk(Query query) {
    entityManager.flush();
    int changed = query.executeUpdate();
    entityManager.clear();
    return changed;
  }
}
