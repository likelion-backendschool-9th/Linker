package com.linker.backend.repository.issue;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** C-owned due projections and producer idempotency over existing notification rows. */
@Repository
public class IssueReminderRepository {
  private final NamedParameterJdbcTemplate sql;

  public IssueReminderRepository(NamedParameterJdbcTemplate sql) {
    this.sql = sql;
  }

  public record Reminder(
      long issue,
      long team,
      long repo,
      int number,
      String title,
      LocalDate due,
      long user,
      String login) {}

  private static final String SELECT =
      "SELECT i.id,i.team_id,i.repo_id,i.number,i.title,i.due_date,u.id AS recipient,u.username"
          + " FROM issues i JOIN teams t ON t.id=i.team_id JOIN team_repos tr ON"
          + " tr.team_id=i.team_id AND tr.repo_id=i.repo_id JOIN github_repos r ON r.id=tr.repo_id"
          + " JOIN issue_assignees a ON a.issue_id=i.id JOIN users u ON u.id=a.user_id JOIN"
          + " team_members m ON m.team_id=i.team_id AND m.user_id=u.id WHERE i.team_id=:team AND"
          + " i.due_date=:due AND i.state='OPEN' AND i.board_status<>'DONE' AND i.deleted_at IS"
          + " NULL AND r.deleted_at IS NULL AND i.project_item_id IS NOT NULL AND t.status IN"
          + " ('ACTIVE','COMPLETED') AND m.left_at IS NULL AND m.github_org_state='MEMBER' AND"
          + " u.user_type='DEVELOPER' AND u.status NOT IN ('DELETED','WITHDRAWING') AND"
          + " u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM auth_identities ai WHERE"
          + " ai.user_id=u.id AND ai.provider='GITHUB' AND"
          + " ai.provider_user_id=CAST(a.github_user_id AS text))";

  public List<Reminder> candidates(long team, LocalDate due) {
    return sql.query(
        SELECT + " ORDER BY i.id,u.id",
        Map.of("team", team, "due", due),
        (rs, n) ->
            new Reminder(
                rs.getLong("id"),
                rs.getLong("team_id"),
                rs.getLong("repo_id"),
                rs.getInt("number"),
                rs.getString("title"),
                rs.getObject("due_date", LocalDate.class),
                rs.getLong("recipient"),
                rs.getString("username")));
  }

  /** Called in the same short transaction as NotificationService.create. */
  public boolean eligible(Reminder r) {
    return !sql.query(
            SELECT
                + " AND i.id=:issue AND u.id=:user AND u.username=:login FOR SHARE OF i,u,m,t,r,tr",
            new MapSqlParameterSource("team", r.team())
                .addValue("due", r.due())
                .addValue("issue", r.issue())
                .addValue("user", r.user())
                .addValue("login", r.login()),
            (rs, n) -> rs.getLong("id"))
        .isEmpty();
  }

  public boolean claimed(String key, long recipient) {
    sql.queryForObject(
        "SELECT pg_advisory_xact_lock(hashtextextended(:key,0))",
        Map.of("key", "linker:" + key),
        Object.class);
    return Boolean.TRUE.equals(
        sql.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM notifications WHERE user_id=:user AND"
                + " notification_type='DUE_SOON' AND group_key=:key)",
            Map.of("user", recipient, "key", key),
            Boolean.class));
  }
}
