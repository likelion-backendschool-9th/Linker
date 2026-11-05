package com.linker.backend.service.user;

import com.linker.backend.dto.issue.response.IssueProgressResponse;
import com.linker.backend.dto.issue.response.IssueProgressResponse.*;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.issue.IssueContextRepository;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserIssueProgressService {
  private final NamedParameterJdbcTemplate jdbc;
  private final UserIssueService reads;
  private final Clock clock;

  public UserIssueProgressService(
      NamedParameterJdbcTemplate jdbc, UserIssueService reads, Clock clock) {
    this.jdbc = jdbc;
    this.reads = reads;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public IssueProgressResponse progress(AuthenticatedUser user, long teamId, int days) {
    reads.requireMember(user, teamId);
    if (days != PlanLimits.ISSUE_PROGRESS_DAYS)
      throw com.linker.backend.dto.issue.request.IssueListQuery.invalid();
    if (!Boolean.TRUE.equals(
        jdbc.queryForObject(
            "SELECT to_regclass('subscriptions') IS NOT NULL", Map.of(), Boolean.class)))
      throw IssueContextRepository.unavailable();
    var p =
        new org.springframework.jdbc.core.namedparam.MapSqlParameterSource("team", teamId)
            .addValue("now", Timestamp.from(clock.instant()));
    boolean flex =
        Boolean.TRUE.equals(
            jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM subscriptions WHERE team_id=:team AND plan='FLEX' AND"
                    + " ((status IN ('TRIALING','ACTIVE') AND current_period_end>:now) OR"
                    + " (status='PAST_DUE' AND grace_until>:now)))",
                p,
                Boolean.class));
    if (!flex)
      throw new ApiException(
          403, "PLAN_LIMIT", "Flex를 구독하면 팀 진행 현황을 볼 수 있어요", Map.of("reason", "PROGRESS_GRAPH"));
    LocalDate today = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE));
    p.addValue("today", today).addValue("soon", today.plusDays(3));
    var counts = counts(teamId);
    long total = counts.todo() + counts.inProgress() + counts.blocked() + counts.done();
    var stored =
        jdbc.query(
            "SELECT snapshot_date,todo_count,in_progress_count,blocked_count,done_count FROM"
                + " team_progress_snapshots WHERE team_id=:team AND snapshot_date>=:from AND"
                + " snapshot_date<:today ORDER BY snapshot_date",
            p.addValue("from", today.minusDays(days - 1)),
            (rs, n) ->
                new Day(
                    rs.getObject(1, LocalDate.class),
                    rs.getLong(2),
                    rs.getLong(3),
                    rs.getLong(4),
                    rs.getLong(5)));
    Map<LocalDate, Day> byDate = new java.util.HashMap<>();
    stored.forEach(d -> byDate.put(d.date(), d));
    var history =
        java.util.stream.IntStream.range(0, days)
            .mapToObj(i -> {
              var date = today.minusDays(days - 1 - i);
              return date.equals(today)
                  ? new Day(
                      today, counts.todo(), counts.inProgress(), counts.blocked(), counts.done())
                  : byDate.getOrDefault(date, new Day(date, null, null, null, null));
            })
            .toList();
    var loads =
        jdbc.query(
            "SELECT u.id,u.username,count(i.id) FROM team_members m JOIN users u ON u.id=m.user_id"
                + " LEFT JOIN issue_assignees a ON a.user_id=u.id LEFT JOIN issues i ON"
                + " i.id=a.issue_id AND i.team_id=:team AND i.deleted_at IS NULL AND i.state='OPEN'"
                + " AND EXISTS(SELECT 1 FROM team_repos vr JOIN github_repos gr ON gr.id=vr.repo_id"
                + " WHERE vr.team_id=i.team_id AND vr.repo_id=i.repo_id AND gr.deleted_at IS NULL)"
                + " WHERE m.team_id=:team AND m.left_at IS NULL AND u.deleted_at IS NULL AND"
                + " u.status<>'DELETED' GROUP BY u.id,u.username ORDER BY u.username,u.id",
            p,
            (rs, n) -> new Workload(rs.getLong(1), rs.getString(2), rs.getLong(3)));
    long overdue =
        jdbc.queryForObject(
            "SELECT count(*) FROM issues WHERE team_id=:team AND deleted_at IS NULL AND EXISTS"
                + " (SELECT 1 FROM team_repos vr JOIN github_repos gr ON gr.id=vr.repo_id WHERE"
                + " vr.team_id=issues.team_id AND vr.repo_id=issues.repo_id AND gr.deleted_at IS"
                + " NULL) AND state='OPEN' AND board_status<>'DONE' AND due_date<:today",
            p,
            Long.class);
    long soon =
        jdbc.queryForObject(
            "SELECT count(*) FROM issues WHERE team_id=:team AND deleted_at IS NULL AND EXISTS"
                + " (SELECT 1 FROM team_repos vr JOIN github_repos gr ON gr.id=vr.repo_id WHERE"
                + " vr.team_id=issues.team_id AND vr.repo_id=issues.repo_id AND gr.deleted_at IS"
                + " NULL) AND state='OPEN' AND board_status<>'DONE' AND due_date BETWEEN :today AND"
                + " :soon",
            p,
            Long.class);
    return new IssueProgressResponse(
        new Completion(
            counts.done(), total, total == 0 ? 0 : (int) Math.round(100.0 * counts.done() / total)),
        counts,
        history,
        loads,
        overdue,
        soon);
  }

  private Counts counts(long teamId) {
    return jdbc.queryForObject(
        "SELECT count(*) FILTER(WHERE s='TODO'),count(*) FILTER(WHERE s='IN_PROGRESS'),count(*)"
            + " FILTER(WHERE s='BLOCKED'),count(*) FILTER(WHERE s='DONE') FROM (SELECT CASE WHEN"
            + " state='CLOSED' THEN 'DONE' ELSE board_status END s FROM issues WHERE team_id=:team"
            + " AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM team_repos vr JOIN github_repos gr"
            + " ON gr.id=vr.repo_id WHERE vr.team_id=issues.team_id AND vr.repo_id=issues.repo_id"
            + " AND gr.deleted_at IS NULL)) q",
        Map.of("team", teamId),
        (rs, n) -> new Counts(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4)));
  }

  /** Midnight stores the day just ended; today's live value is never backfilled as history. */
  @Transactional
  public void snapshot() {
    var today = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE));
    var p = Map.of("date", today.minusDays(1), "today", today, "cutoff", today.minusYears(1));
    jdbc.update(
        "INSERT INTO"
            + " team_progress_snapshots(team_id,snapshot_date,todo_count,in_progress_count,blocked_count,done_count,overdue_count)"
            + " SELECT t.id,:date,count(i.id) FILTER(WHERE i.state<>'CLOSED' AND"
            + " i.board_status='TODO'),count(i.id) FILTER(WHERE i.state<>'CLOSED' AND"
            + " i.board_status='IN_PROGRESS'),count(i.id) FILTER(WHERE i.state<>'CLOSED' AND"
            + " i.board_status='BLOCKED'),count(i.id) FILTER(WHERE i.state='CLOSED' OR"
            + " i.board_status='DONE'),count(i.id) FILTER(WHERE i.state='OPEN' AND"
            + " i.board_status<>'DONE' AND i.due_date<:today) FROM teams t LEFT JOIN issues i ON"
            + " i.team_id=t.id AND i.deleted_at IS NULL AND EXISTS(SELECT 1 FROM team_repos vr JOIN"
            + " github_repos gr ON gr.id=vr.repo_id WHERE vr.team_id=i.team_id AND"
            + " vr.repo_id=i.repo_id AND gr.deleted_at IS NULL) WHERE t.status<>'DELETED' GROUP BY"
            + " t.id ON CONFLICT(team_id,snapshot_date) DO NOTHING",
        p);
    jdbc.update("DELETE FROM team_progress_snapshots WHERE snapshot_date<:cutoff", p);
  }
}
