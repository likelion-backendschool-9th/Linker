package com.linker.backend.repository.issue;

import com.linker.backend.global.error.ApiException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Durable desired values only. Never stores access tokens or provider error bodies. */
@Repository
public class IssueEditJobRepository {
  private final NamedParameterJdbcTemplate sql;

  public IssueEditJobRepository(NamedParameterJdbcTemplate sql) {
    this.sql = sql;
  }

  public record Job(
      long id,
      long team,
      long issue,
      long actor,
      String step,
      String payload,
      String status,
      int attempts,
      Instant nextRetry) {}

  public boolean ready() {
    return Boolean.TRUE.equals(
        sql.queryForObject(
            "SELECT to_regclass('issue_sync_jobs') IS NOT NULL", Map.of(), Boolean.class));
  }

  public long create(long issue, long actor, String step, String payload, Instant now) {
    if (!ready()) throw IssueContextRepository.unavailable();
    if (Boolean.TRUE.equals(
        sql.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM issue_sync_jobs WHERE issue_id=:id AND status IN"
                + " ('PENDING','RUNNING'))",
            Map.of("id", issue),
            Boolean.class)))
      throw new ApiException(409, "STATE_CONFLICT", "이전 변경을 GitHub에 반영하고 있어요. 잠시 후 다시 시도해 주세요");
    long id =
        sql.queryForObject(
            "INSERT INTO issue_sync_jobs(issue_id,requested_by,step,payload,status,next_retry_at)"
                + " VALUES(:issue,:actor,:step,CAST(:payload AS jsonb),'PENDING',:now) RETURNING"
                + " id",
            Map.of(
                "issue",
                issue,
                "actor",
                actor,
                "step",
                step,
                "payload",
                payload,
                "now",
                Timestamp.from(now)),
            Long.class);
    sql.update("UPDATE issues SET sync_status='PENDING' WHERE id=:id", Map.of("id", issue));
    return id;
  }

  public Job get(long id) {
    return sql.queryForObject(
        "SELECT j.*,i.team_id FROM issue_sync_jobs j JOIN issues i ON i.id=j.issue_id WHERE"
            + " j.id=:id",
        Map.of("id", id),
        (rs, n) ->
            new Job(
                rs.getLong("id"),
                rs.getLong("team_id"),
                rs.getLong("issue_id"),
                rs.getLong("requested_by"),
                rs.getString("step"),
                rs.getString("payload"),
                rs.getString("status"),
                rs.getInt("attempts"),
                rs.getTimestamp("next_retry_at").toInstant()));
  }

  public List<Long> due(Instant now) {
    if (!ready()) return List.of();
    return sql.queryForList(
        "SELECT id FROM issue_sync_jobs WHERE status IN ('PENDING','RUNNING') AND"
            + " next_retry_at<=:now ORDER BY next_retry_at,id LIMIT 100",
        Map.of("now", Timestamp.from(now)),
        Long.class);
  }

  public void start(long id, Instant leaseEnd) {
    sql.update(
        "UPDATE issue_sync_jobs SET status='RUNNING',attempts=attempts+1,next_retry_at=:lease WHERE"
            + " id=:id",
        Map.of("id", id, "lease", Timestamp.from(leaseEnd)));
  }

  public void done(long id, long issue) {
    sql.update(
        "UPDATE issue_sync_jobs SET status='DONE',last_error=NULL WHERE id=:id", Map.of("id", id));
    sql.update("UPDATE issues SET sync_status='SYNCED' WHERE id=:id", Map.of("id", issue));
  }

  public void failed(long id, long issue, boolean terminal, String error, Instant retryAt) {
    int changed =
        sql.update(
            "UPDATE issue_sync_jobs SET status=:status,last_error=:error,next_retry_at=:retry WHERE"
                + " id=:id AND status<>'DONE'",
            Map.of(
                "id",
                id,
                "status",
                terminal ? "FAILED" : "PENDING",
                "error",
                error,
                "retry",
                Timestamp.from(retryAt)));
    if (changed == 1)
      sql.update("UPDATE issues SET sync_status='FAILED' WHERE id=:id", Map.of("id", issue));
  }
}
