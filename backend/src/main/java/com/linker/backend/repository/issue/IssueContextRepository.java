package com.linker.backend.repository.issue;

import com.linker.backend.global.error.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Reads B-owned ERD projections; never creates/updates B's shared schema. */
@Repository
public class IssueContextRepository {
  private final NamedParameterJdbcTemplate jdbc;

  public IssueContextRepository(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public record Repo(long id, long githubId, String owner, String name) {
    public String fullName() {
      return owner + "/" + name;
    }
  }

  public record Board(
      String nodeId,
      String statusField,
      String startField,
      String dueField,
      Map<String, String> statuses) {}

  public record Context(
      long teamId,
      long installationId,
      long orgId,
      String orgLogin,
      String status,
      Board board,
      List<Repo> repos) {
    public boolean writable() {
      return "ACTIVE".equals(status) || "COMPLETED".equals(status);
    }
  }

  public boolean ready() {
    return Boolean.TRUE.equals(
        jdbc.queryForObject(
            "SELECT bool_and(to_regclass(n) IS NOT NULL) FROM unnest(ARRAY["
                + "'teams','team_members','team_repos','github_installations','github_repos','team_project_boards','board_status_mappings','issues','issue_assignees','issue_labels','team_progress_snapshots'])"
                + " n",
            Map.of(),
            Boolean.class));
  }

  public Context get(long teamId) {
    if (!ready()) throw unavailable();
    var p = Map.of("team", teamId);
    var rows =
        jdbc.query(
            "SELECT t.id,gi.github_installation_id,t.github_org_id,t.github_org_login,t.status,"
                + " b.id AS"
                + " board_id,b.github_project_node_id,b.status_field_id,b.start_date_field_id,b.due_date_field_id"
                + " FROM teams t JOIN github_installations gi ON gi.id=t.installation_id JOIN"
                + " team_project_boards b ON b.team_id=t.id WHERE t.id=:team AND t.status <>"
                + " 'DELETED'",
            p,
            (rs, n) ->
                new Object[] {
                  rs.getLong("id"),
                  rs.getLong("github_installation_id"),
                  rs.getLong("github_org_id"),
                  rs.getString("github_org_login"),
                  rs.getString("status"),
                  rs.getLong("board_id"),
                  rs.getString("github_project_node_id"),
                  rs.getString("status_field_id"),
                  rs.getString("start_date_field_id"),
                  rs.getString("due_date_field_id")
                });
    if (rows.size() != 1) throw new ApiException(404, "NOT_FOUND", "팀 연결 정보를 찾을 수 없어요");
    var r = rows.getFirst();
    Map<String, String> mapping = new LinkedHashMap<>();
    jdbc.query(
        "SELECT github_option_id,linker_status FROM board_status_mappings WHERE board_id=:board"
            + " ORDER BY github_option_id",
        Map.of("board", r[5]),
        rs -> {
          mapping.put(rs.getString(1), rs.getString(2));
        });
    var repos =
        jdbc.query(
            "SELECT r.id,r.github_repo_id,r.owner_login,r.name FROM team_repos tr JOIN github_repos"
                + " r ON r.id=tr.repo_id WHERE tr.team_id=:team AND r.deleted_at IS NULL ORDER BY"
                + " r.id",
            p,
            (rs, n) -> new Repo(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4)));
    return new Context(
        (long) r[0],
        (long) r[1],
        (long) r[2],
        (String) r[3],
        (String) r[4],
        new Board((String) r[6], (String) r[7], (String) r[8], (String) r[9], Map.copyOf(mapping)),
        List.copyOf(repos));
  }

  public List<Long> syncTeams() {
    if (!ready()) return List.of();
    return jdbc.queryForList(
        "SELECT t.id FROM teams t JOIN github_installations gi ON gi.id=t.installation_id WHERE"
            + " t.status IN ('ACTIVE','COMPLETED') AND gi.removed_at IS NULL AND gi.suspended_at IS"
            + " NULL ORDER BY t.id",
        Map.of(),
        Long.class);
  }

  public static ApiException unavailable() {
    return new ApiException(503, "SERVICE_UNAVAILABLE", "팀·이슈 연결 준비가 필요해요");
  }
}
