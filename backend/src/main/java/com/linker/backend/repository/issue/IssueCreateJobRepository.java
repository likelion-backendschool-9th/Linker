package com.linker.backend.repository.issue;

import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Existing issue_sync_jobs, also stores a pre-GitHub intent without inventing a local issue. */
@Repository
public class IssueCreateJobRepository {
  private final NamedParameterJdbcTemplate sql;

  public IssueCreateJobRepository(NamedParameterJdbcTemplate sql) {
    this.sql = sql;
  }

  public record Job(
      long id,
      long team,
      long actor,
      Long issue,
      String payload,
      String status,
      int attempts,
      Instant retry,
      Instant created,
      String error) {}

  private static final String SELECT = "SELECT * FROM issue_sync_jobs WHERE step='CREATE'";

  public boolean ready() {
    return Boolean.TRUE.equals(
        sql.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('issue_sync_jobs')"
                + " AND attname='request_key' AND NOT attisdropped)",
            Map.of(),
            Boolean.class));
  }

  private List<Job> query(String suffix, Map<String, ?> p) {
    return sql.query(
        SELECT + suffix,
        p,
        (r, n) ->
            new Job(
                r.getLong("id"),
                r.getLong("team_id"),
                r.getLong("requested_by"),
                r.getObject("issue_id", Long.class),
                r.getString("payload"),
                r.getString("status"),
                r.getInt("attempts"),
                r.getTimestamp("next_retry_at").toInstant(),
                r.getTimestamp("created_at").toInstant(),
                r.getString("last_error")));
  }

  public Job get(long id) {
    return query(" AND id=:id", Map.of("id", id)).stream()
        .findFirst()
        .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "생성 작업을 찾을 수 없어요"));
  }

  public Job existing(long actor, UUID key) {
    return query(
            " AND requested_by=:actor AND request_key=:key", Map.of("actor", actor, "key", key))
        .stream()
        .findFirst()
        .orElse(null);
  }

  public long create(long team, long actor, UUID key, String payload, Instant now) {
    // Called in a short transaction. Serializes the per-author daily quota across teams/instances.
    sql.queryForObject(
        "SELECT pg_advisory_xact_lock(hashtextextended(:key,0))",
        Map.of("key", "linker:create-author:" + actor),
        Object.class);
    Job prior = existing(actor, key);
    if (prior != null) return prior.id();
    Instant start =
        now.atZone(PlanLimits.APP_ZONE).toLocalDate().atStartOfDay(PlanLimits.APP_ZONE).toInstant();
    long count =
        sql.queryForObject(
            "SELECT count(*) FROM issue_sync_jobs WHERE step='CREATE' AND requested_by=:actor AND"
                + " created_at>=:start AND created_at<:end",
            new MapSqlParameterSource("actor", actor)
                .addValue("start", Timestamp.from(start))
                .addValue("end", Timestamp.from(start.plusSeconds(86400))),
            Long.class);
    if (count >= PlanLimits.ISSUE_CREATES_PER_DAY)
      throw new ApiException(429, "RATE_LIMITED", "오늘 만들 수 있는 이슈 수를 모두 사용했어요");
    return sql.queryForObject(
        "INSERT INTO"
            + " issue_sync_jobs(team_id,issue_id,requested_by,request_key,step,payload,status,created_at,next_retry_at)"
            + " VALUES(:team,NULL,:actor,:key,'CREATE',CAST(:payload AS jsonb),'PENDING',:now,:now)"
            + " RETURNING id",
        Map.of(
            "team",
            team,
            "actor",
            actor,
            "key",
            key,
            "payload",
            payload,
            "now",
            Timestamp.from(now)),
        Long.class);
  }

  public List<Long> due(Instant now) {
    if (!ready()) return List.of();
    return sql.queryForList(
        "SELECT id FROM issue_sync_jobs WHERE step='CREATE' AND status IN ('PENDING','RUNNING') AND"
            + " next_retry_at<=:now ORDER BY next_retry_at,id LIMIT 100",
        Map.of("now", Timestamp.from(now)),
        Long.class);
  }

  public void start(long id, Instant lease) {
    sql.update(
        "UPDATE issue_sync_jobs SET status='RUNNING',attempts=attempts+1,next_retry_at=:at WHERE"
            + " id=:id AND status IN ('PENDING','RUNNING')",
        Map.of("id", id, "at", Timestamp.from(lease)));
  }

  public void checkpoint(long id, String payload, Long issue) {
    sql.update(
        "UPDATE issue_sync_jobs SET payload=CAST(:payload AS jsonb),issue_id=:issue WHERE id=:id",
        new MapSqlParameterSource("id", id).addValue("payload", payload).addValue("issue", issue));
  }

  public void done(long id, long issue) {
    sql.update(
        "UPDATE issue_sync_jobs SET status='DONE',last_error=NULL,issue_id=:issue WHERE id=:id",
        Map.of("id", id, "issue", issue));
    sql.update("UPDATE issues SET sync_status='SYNCED' WHERE id=:id", Map.of("id", issue));
  }

  public void failed(long id, boolean terminal, String error, Instant next) {
    sql.update(
        "UPDATE issue_sync_jobs SET status=:status,last_error=:error,next_retry_at=:at WHERE id=:id"
            + " AND status<>'DONE'",
        Map.of(
            "id",
            id,
            "status",
            terminal ? "FAILED" : "PENDING",
            "error",
            error,
            "at",
            Timestamp.from(next)));
    sql.update(
        "UPDATE issues SET sync_status='FAILED' WHERE id=(SELECT issue_id FROM issue_sync_jobs"
            + " WHERE id=:id AND status<>'DONE')",
        Map.of("id", id));
  }

  public void markOrigin(long issue, long actor, boolean done) {
    sql.update(
        "UPDATE issues SET created_via_linker=true,author_user_id=:actor,sync_status=:status WHERE"
            + " id=:id",
        Map.of("actor", actor, "id", issue, "status", done ? "SYNCED" : "PENDING"));
  }

  public List<Long> recipients(long team, long github) {
    return sql.queryForList(
        "SELECT DISTINCT ai.user_id FROM auth_identities ai JOIN team_members m ON"
            + " m.user_id=ai.user_id AND m.team_id=:team AND m.left_at IS NULL JOIN users u ON"
            + " u.id=ai.user_id AND u.status='ACTIVE' AND u.deleted_at IS NULL WHERE"
            + " ai.provider='GITHUB' AND ai.provider_user_id=:github",
        Map.of("team", team, "github", Long.toString(github)),
        Long.class);
  }
}
