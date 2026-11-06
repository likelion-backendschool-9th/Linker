package com.linker.backend.repository.issue;

import com.linker.backend.dto.issue.response.IssueDetailResponse.Person;
import com.linker.backend.dto.issue.response.IssueListResponse;
import com.linker.backend.global.error.ApiException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class IssueDetailRepository {
  private final NamedParameterJdbcTemplate sql;

  public IssueDetailRepository(NamedParameterJdbcTemplate sql) {
    this.sql = sql;
  }

  public record Row(
      long id,
      long repoId,
      long githubId,
      String nodeId,
      int number,
      String itemId,
      String title,
      String state,
      String status,
      LocalDate start,
      LocalDate due,
      String author,
      String url,
      Instant created,
      Instant updated,
      String sync,
      boolean deleted) {}

  public Row get(long team, long id) {
    var rows =
        sql.query(
            "SELECT * FROM issues WHERE team_id=:team AND id=:id",
            Map.of("team", team, "id", id),
            (rs, n) ->
                new Row(
                    rs.getLong("id"),
                    rs.getLong("repo_id"),
                    rs.getLong("github_issue_id"),
                    rs.getString("github_node_id"),
                    rs.getInt("number"),
                    rs.getString("project_item_id"),
                    rs.getString("title"),
                    rs.getString("state"),
                    rs.getString("board_status"),
                    rs.getObject("start_date", LocalDate.class),
                    rs.getObject("due_date", LocalDate.class),
                    rs.getString("author_login"),
                    rs.getString("html_url"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("github_updated_at").toInstant(),
                    rs.getString("sync_status"),
                    rs.getTimestamp("deleted_at") != null));
    if (rows.size() != 1) throw new ApiException(404, "NOT_FOUND", "이슈를 찾을 수 없어요");
    return rows.getFirst();
  }

  public List<IssueListResponse.Assignee> assignees(long team, long issue) {
    return sql.query(
        "SELECT a.user_id,a.github_login,u.display_name,u.avatar_url,EXISTS(SELECT 1 FROM"
            + " team_members m WHERE m.team_id=:team AND m.user_id=a.user_id AND m.left_at IS NULL)"
            + " AS in_team FROM issue_assignees a LEFT JOIN users u ON u.id=a.user_id WHERE"
            + " a.issue_id=:id ORDER BY a.github_login",
        Map.of("team", team, "id", issue),
        (rs, n) ->
            new IssueListResponse.Assignee(
                rs.getObject(1, Long.class),
                rs.getString(2),
                rs.getString(3) == null ? rs.getString(2) : rs.getString(3),
                rs.getString(4),
                rs.getBoolean(5)));
  }

  public List<IssueListResponse.Label> labels(long issue) {
    return sql.query(
        "SELECT name,color FROM issue_labels WHERE issue_id=:id ORDER BY name",
        Map.of("id", issue),
        (rs, n) -> new IssueListResponse.Label(rs.getString(1), rs.getString(2)));
  }

  public Person author(long githubId, String login) {
    var found =
        sql.query(
            "SELECT u.id,u.display_name,u.avatar_url FROM auth_identities a JOIN users u ON"
                + " u.id=a.user_id WHERE a.provider='GITHUB' AND a.provider_user_id=:github AND"
                + " u.deleted_at IS NULL AND u.status<>'DELETED'",
            Map.of("github", Long.toString(githubId)),
            (rs, n) ->
                new Person(
                    rs.getLong(1),
                    login,
                    rs.getString(2) == null ? login : rs.getString(2),
                    rs.getString(3)));
    return found.isEmpty() ? new Person(null, login, login, null) : found.getFirst();
  }

  /** Caller holds the team lock and a short transaction, after the full source read completes. */
  public void subIssues(
      long team,
      long parent,
      com.linker.backend.dto.issue.response.IssueDetailResponse.SubIssues children) {
    var ids =
        children.items().stream()
            .map(com.linker.backend.dto.issue.response.IssueDetailResponse.SubIssue::id)
            .filter(java.util.Objects::nonNull)
            .toList();
    sql.update(
        "UPDATE issues SET sub_issues_total=:total,sub_issues_done=:done WHERE id=:id AND"
            + " team_id=:team",
        Map.of("id", parent, "team", team, "total", children.total(), "done", children.done()));
    if (ids.isEmpty())
      sql.update(
          "UPDATE issues SET parent_issue_id=NULL WHERE parent_issue_id=:parent AND team_id=:team",
          Map.of("parent", parent, "team", team));
    else {
      var args = Map.of("parent", parent, "team", team, "ids", ids);
      sql.update(
          "UPDATE issues SET parent_issue_id=NULL WHERE parent_issue_id=:parent AND team_id=:team"
              + " AND id NOT IN (:ids)",
          args);
      sql.update(
          "UPDATE issues SET parent_issue_id=:parent WHERE id IN (:ids) AND team_id=:team AND"
              + " id<>:parent",
          args);
    }
  }

  public List<Person> candidates(long team) {
    if (!Boolean.TRUE.equals(
        sql.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('team_members')"
                + " AND attname='github_org_state' AND NOT attisdropped)",
            Map.of(),
            Boolean.class))) throw IssueContextRepository.unavailable();
    return sql.query(
        "SELECT u.id,u.username,u.display_name,u.avatar_url FROM team_members m JOIN users u ON"
            + " u.id=m.user_id JOIN auth_identities a ON a.user_id=u.id AND a.provider='GITHUB'"
            + " WHERE m.team_id=:team AND m.left_at IS NULL AND m.github_org_state='MEMBER' AND"
            + " u.status='ACTIVE' AND u.deleted_at IS NULL ORDER BY u.id",
        Map.of("team", team),
        (rs, n) -> new Person(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)));
  }

  public Long linkedId(long team, long github) {
    return sql
        .query(
            "SELECT i.id FROM issues i JOIN team_repos tr ON tr.team_id=i.team_id AND"
                + " tr.repo_id=i.repo_id JOIN github_repos r ON r.id=tr.repo_id WHERE"
                + " i.team_id=:team AND i.github_issue_id=:github AND i.deleted_at IS NULL AND"
                + " r.deleted_at IS NULL",
            Map.of("team", team, "github", github),
            (rs, n) -> rs.getLong(1))
        .stream()
        .findFirst()
        .orElse(null);
  }

  public com.linker.backend.global.security.AuthenticatedUser actor(long user) {
    return sql.queryForObject(
        "SELECT username,user_type,status FROM users WHERE id=:id",
        Map.of("id", user),
        (rs, n) ->
            new com.linker.backend.global.security.AuthenticatedUser(
                user,
                rs.getString(1),
                com.linker.backend.entity.account.UserType.valueOf(rs.getString(2)),
                com.linker.backend.entity.account.UserStatus.valueOf(rs.getString(3)),
                null,
                false,
                false,
                false,
                0));
  }
}
