package com.linker.backend.repository.issue;

import com.linker.backend.dto.issue.request.IssueListQuery;
import com.linker.backend.dto.issue.response.IssueFilterOptionsResponse;
import com.linker.backend.dto.issue.response.IssueListResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read projections over the ERD cache. Does not create B-owned tables or call GitHub. */
@Repository
public class IssueReadRepository {
  private final NamedParameterJdbcTemplate jdbc;

  public IssueReadRepository(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public IssueListResponse list(
      long teamId, IssueListQuery query, boolean unscheduled, LocalDate today) {
    var params = new MapSqlParameterSource("team", teamId);
    String where =
        " FROM issues i JOIN github_repos r ON r.id = i.repo_id"
            + " JOIN team_repos tr ON tr.repo_id = i.repo_id AND tr.team_id = i.team_id"
            + " WHERE i.team_id = :team AND i.deleted_at IS NULL AND r.deleted_at IS NULL";
    if (unscheduled) where += " AND (i.project_item_id IS NULL OR i.due_date IS NULL)";
    if (query.repo() != null) {
      where += " AND i.repo_id = :repo";
      params.addValue("repo", query.repo());
    }
    if (query.status() != null) {
      where += " AND (CASE WHEN i.state = 'CLOSED' THEN 'DONE' ELSE i.board_status END) = :status";
      params.addValue("status", query.status());
    }
    if (query.open()) where += " AND i.state = 'OPEN'";
    if (query.assignee() != null) {
      where +=
          " AND EXISTS (SELECT 1 FROM issue_assignees a WHERE a.issue_id = i.id AND a.github_login"
              + " = :assignee)";
      params.addValue("assignee", query.assignee());
    }
    if (query.label() != null) {
      where +=
          " AND EXISTS (SELECT 1 FROM issue_labels l WHERE l.issue_id = i.id AND l.name = :label)";
      params.addValue("label", query.label());
    }
    String scope = scope(teamId, query, unscheduled);
    Cursor after = decode(query.cursor(), scope);
    long total = jdbc.queryForObject("SELECT count(*)" + where, params, Long.class);
    if (after != null) {
      where +=
          " AND (COALESCE(i.github_updated_at, TIMESTAMPTZ '1970-01-01 00:00:00+00'), i.id)"
              + " < (CAST(:updated AS timestamptz), :id)";
      params.addValue("updated", after.updated().toString()).addValue("id", after.id());
    }
    params.addValue("limit", query.size() + 1);
    var rows =
        jdbc.query(
            "SELECT i.*, r.name AS repo_name, COALESCE(i.github_updated_at, TIMESTAMPTZ '1970-01-01"
                + " 00:00:00+00') AS sort_updated"
                + where
                + " ORDER BY sort_updated DESC, i.id DESC LIMIT :limit",
            params,
            (rs, n) ->
                new Row(
                    rs.getLong("id"),
                    rs.getInt("number"),
                    rs.getLong("repo_id"),
                    rs.getString("repo_name"),
                    rs.getString("title"),
                    rs.getString("board_status"),
                    rs.getString("state"),
                    date(rs, "start_date"),
                    date(rs, "due_date"),
                    rs.getString("project_item_id") != null,
                    "FAILED".equals(rs.getString("sync_status")),
                    rs.getTimestamp("sort_updated").toInstant(),
                    rs.getString("sync_status"),
                    rs.getTimestamp("synced_at") == null
                        ? null
                        : rs.getTimestamp("synced_at").toInstant()));
    boolean more = rows.size() > query.size();
    var page = rows.subList(0, Math.min(rows.size(), query.size()));
    if (page.isEmpty()) return new IssueListResponse(List.of(), null, total, false, "NOT_CHECKED");
    List<Long> ids = page.stream().map(Row::id).toList();
    var children = new MapSqlParameterSource("ids", ids).addValue("team", teamId);
    Map<Long, List<IssueListResponse.Assignee>> assignees = new HashMap<>();
    jdbc.query(
        "SELECT a.*, u.display_name, u.avatar_url, EXISTS (SELECT 1 FROM team_members m"
            + " WHERE m.team_id = :team AND m.user_id = a.user_id AND m.left_at IS NULL) AS in_team"
            + " FROM issue_assignees a LEFT JOIN users u ON u.id = a.user_id"
            + " WHERE a.issue_id IN (:ids) ORDER BY a.github_login, a.id",
        children,
        rs -> {
          Long userId = rs.getObject("user_id", Long.class);
          String login = rs.getString("github_login");
          String name = rs.getString("display_name");
          assignees
              .computeIfAbsent(rs.getLong("issue_id"), k -> new ArrayList<>())
              .add(
                  new IssueListResponse.Assignee(
                      userId,
                      login,
                      name == null ? login : name,
                      rs.getString("avatar_url"),
                      rs.getBoolean("in_team")));
        });
    Map<Long, List<IssueListResponse.Label>> labels = new HashMap<>();
    jdbc.query(
        "SELECT issue_id, name, color FROM issue_labels WHERE issue_id IN (:ids) ORDER BY name",
        children,
        rs -> {
          labels
              .computeIfAbsent(rs.getLong("issue_id"), k -> new ArrayList<>())
              .add(new IssueListResponse.Label(rs.getString("name"), rs.getString("color")));
        });
    var items =
        page.stream()
            .map(row ->
                new IssueListResponse.Item(
                    row.id(),
                    row.number(),
                    row.repoId(),
                    row.repoName(),
                    row.title(),
                    "CLOSED".equals(row.state()) ? "DONE" : row.status(),
                    row.state(),
                    List.copyOf(assignees.getOrDefault(row.id(), List.of())),
                    List.copyOf(labels.getOrDefault(row.id(), List.of())),
                    row.start(),
                    row.due(),
                    "OPEN".equals(row.state())
                        && row.due() != null
                        && row.due().isBefore(today)
                        && !"DONE".equals(row.status()),
                    row.inProject(),
                    row.syncFailed(),
                    row.syncStatus(),
                    row.syncedAt()))
            .toList();
    Row last = page.getLast();
    // Unknown until repository-write authorization lands; never infer it from team membership.
    return new IssueListResponse(
        items, more ? encode(scope, last.updated(), last.id()) : null, total, false, "NOT_CHECKED");
  }

  public IssueFilterOptionsResponse options(long teamId) {
    var params = new MapSqlParameterSource("team", teamId);
    var repos =
        jdbc.query(
            "SELECT r.id, r.name FROM team_repos tr JOIN github_repos r ON r.id = tr.repo_id"
                + " WHERE tr.team_id = :team AND r.deleted_at IS NULL ORDER BY r.name, r.id",
            params,
            (rs, n) -> new IssueFilterOptionsResponse.Repo(rs.getLong("id"), rs.getString("name")));
    var labels =
        jdbc.query(
            "SELECT DISTINCT l.name, l.color FROM issue_labels l JOIN issues i ON i.id = l.issue_id"
                + " JOIN github_repos r ON r.id = i.repo_id JOIN team_repos tr ON tr.repo_id ="
                + " i.repo_id AND tr.team_id = i.team_id WHERE i.team_id = :team AND i.deleted_at"
                + " IS NULL AND r.deleted_at IS NULL ORDER BY l.name, l.color",
            params,
            (rs, n) -> new IssueListResponse.Label(rs.getString("name"), rs.getString("color")));
    var members =
        jdbc.query(
            "SELECT DISTINCT u.id, u.username, u.display_name, u.avatar_url FROM team_members m"
                + " JOIN users u ON u.id = m.user_id WHERE m.team_id = :team AND m.left_at IS NULL"
                + " AND u.deleted_at IS NULL AND u.status <> 'DELETED' ORDER BY u.username, u.id",
            params,
            (rs, n) ->
                new IssueFilterOptionsResponse.Member(
                    rs.getLong("id"),
                    rs.getString("username"),
                    rs.getString("display_name") == null
                        ? rs.getString("username")
                        : rs.getString("display_name"),
                    rs.getString("avatar_url")));
    return new IssueFilterOptionsResponse(
        repos, labels, members, List.of("TODO", "IN_PROGRESS", "BLOCKED", "DONE", "OTHER", "NONE"));
  }

  private static LocalDate date(ResultSet rs, String field) throws SQLException {
    return rs.getObject(field, LocalDate.class);
  }

  private record Row(
      long id,
      int number,
      long repoId,
      String repoName,
      String title,
      String status,
      String state,
      LocalDate start,
      LocalDate due,
      boolean inProject,
      boolean syncFailed,
      Instant updated,
      String syncStatus,
      Instant syncedAt) {}

  private record Cursor(Instant updated, long id) {}

  private static String scopeField(String value) {
    return value == null
        ? "-"
        : Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(value.getBytes(StandardCharsets.UTF_8));
  }

  private static String scope(long teamId, IssueListQuery q, boolean unscheduled) {
    String raw =
        teamId
            + "|"
            + unscheduled
            + "|"
            + q.repo()
            + "|"
            + q.status()
            + "|"
            + scopeField(q.assignee())
            + "|"
            + scopeField(q.label())
            + "|"
            + q.open();
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  private static String encode(String scope, Instant updated, long id) {
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString((scope + "|" + updated + "|" + id).getBytes(StandardCharsets.UTF_8));
  }

  private static Cursor decode(String encoded, String scope) {
    if (encoded == null) return null;
    try {
      String[] parts =
          new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8)
              .split("\\|", -1);
      if (parts.length != 3 || !scope.equals(parts[0])) throw IssueListQuery.invalid();
      long id = Long.parseLong(parts[2]);
      if (id <= 0) throw IssueListQuery.invalid();
      return new Cursor(Instant.parse(parts[1]), id);
    } catch (IllegalArgumentException | java.time.format.DateTimeParseException e) {
      throw IssueListQuery.invalid();
    }
  }
}
