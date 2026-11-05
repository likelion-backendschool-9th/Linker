package com.linker.backend.repository.team;

import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.dto.team.request.CreateTeamRequest;
import com.linker.backend.dto.team.response.TeamSetupResponse.Created;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.integration.github.GithubTeamSource.Repository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/** Shared ERD persistence; callers own short transactions and never perform HTTP inside them. */
@org.springframework.stereotype.Repository
public class TeamSetupRepository {
  private final JdbcTemplate jdbc;

  public TeamSetupRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public record Team(long id, long installationId, long orgId, String orgLogin, String status) {}

  public boolean ready(String... tables) {
    for (String table : tables) {
      if (!Boolean.TRUE.equals(
          jdbc.queryForObject(
              "select to_regclass(?) is not null", Boolean.class, "public." + table))) return false;
    }
    return true;
  }

  public void requireSchema(String... tables) {
    if (!ready(tables)) throw new ApiException(503, "SERVICE_UNAVAILABLE", "팀 연결 준비가 필요해요");
  }

  public Team team(long id) {
    requireSchema("teams", "team_members", "github_installations");
    var teams =
        jdbc.query(
            """
                select t.id,i.github_installation_id,t.github_org_id,t.github_org_login,t.status
                from teams t join github_installations i on i.id=t.installation_id
                where t.id=? and t.status<>'DELETED'
                """,
            (r, n) ->
                new Team(r.getLong(1), r.getLong(2), r.getLong(3), r.getString(4), r.getString(5)),
            id);
    if (teams.isEmpty()) throw new ApiException(404, "NOT_FOUND", "팀을 찾을 수 없어요");
    return teams.getFirst();
  }

  public Long linkedOrg(long orgId) {
    if (!ready("teams")) return null;
    var ids = jdbc.queryForList("select id from teams where github_org_id=?", Long.class, orgId);
    return ids.isEmpty() ? null : ids.getFirst();
  }

  public boolean currentMember(long userId, long teamId) {
    return ready("team_members")
        && Boolean.TRUE.equals(
            jdbc.queryForObject(
                "select exists(select 1 from team_members where user_id=? and team_id=? and left_at is null)",
                Boolean.class,
                userId,
                teamId));
  }

  public boolean lockActiveDeveloper(long userId) {
    // Serializes all creates for this account, including concurrent different-org requests.
    return !jdbc.queryForList(
            "select id from users where id=? and user_type='DEVELOPER' and status='ACTIVE' and deleted_at is null for update",
            Long.class,
            userId)
        .isEmpty();
  }

  public boolean currentOwner(long userId, long teamId) {
    return Boolean.TRUE.equals(
        jdbc.queryForObject(
            "select exists(select 1 from team_members where team_id=? and user_id=? and role='OWNER' and left_at is null)",
            Boolean.class,
            teamId,
            userId));
  }

  public long countedTeams(long userId) {
    return jdbc.queryForObject(
        "select count(*) from team_members m join teams t on t.id=m.team_id where m.user_id=? and m.left_at is null and t.status not in ('ARCHIVED','DELETED')",
        Long.class,
        userId);
  }

  public Created reconnect(
      long teamId, long userId, GithubInstallationView verified, String nextStatus, Instant now) {
    long installation = upsertInstallation(userId, verified, now);
    jdbc.update(
        "update teams set installation_id=?,github_org_login=?,status=?,read_only_since=null,updated_at=? where id=?",
        installation,
        verified.login(),
        nextStatus,
        Timestamp.from(now),
        teamId);
    return created(teamId);
  }

  public Created create(
      long userId, GithubInstallationView verified, CreateTeamRequest command, Instant now) {
    var at = Timestamp.from(now);
    long installation = upsertInstallation(userId, verified, now);
    long id =
        jdbc.queryForObject(
            """
                insert into teams(installation_id,github_org_id,github_org_login,name,description,avatar_url,status,created_by,created_at,updated_at)
                values (?,?,?,?,?,?,'ACTIVE',?,?,?) returning id
                """,
            Long.class,
            installation,
            verified.orgId(),
            verified.login(),
            command.name().trim(),
            command.description(),
            verified.avatarUrl(),
            userId,
            at,
            at);
    jdbc.update(
        "insert into team_members(team_id,user_id,role,github_org_state,joined_at,created_at,updated_at) values (?,?,'OWNER','MEMBER',?,?,?)",
        id,
        userId,
        at,
        at,
        at);
    long room =
        jdbc.queryForObject(
            "insert into chat_rooms(room_type,team_id,created_at,updated_at) values ('TEAM',?,?,?) returning id",
            Long.class,
            id,
            at,
            at);
    jdbc.update(
        "insert into chat_room_members(room_id,user_id,joined_at,created_at,updated_at) values (?,?,?,?,?)",
        room,
        userId,
        at,
        at,
        at);
    return new Created(id, command.name().trim(), room);
  }

  public long upsertInstallation(long userId, GithubInstallationView verified, Instant now) {
    var at = Timestamp.from(now);
    return jdbc.queryForObject(
        """
                insert into github_installations(github_installation_id,account_id,account_login,account_type,repository_selection,installed_by,created_at,updated_at)
                values (?,?,?,'Organization',?,?,?,?)
                on conflict(github_installation_id) do update set account_login=excluded.account_login,repository_selection=excluded.repository_selection,removed_at=null,suspended_at=null,updated_at=excluded.updated_at
                where github_installations.account_id=excluded.account_id returning id
                """,
        Long.class,
        verified.installationId(),
        verified.orgId(),
        verified.login(),
        verified.repositorySelection(),
        userId,
        at,
        at);
  }

  private Created created(long id) {
    return jdbc.queryForObject(
        "select t.id,t.name,r.id from teams t join chat_rooms r on r.team_id=t.id and r.room_type='TEAM' where t.id=?",
        (r, n) -> new Created(r.getLong(1), r.getString(2), r.getLong(3)),
        id);
  }

  public void assertUnchanged(Team expected) {
    jdbc.queryForObject("select id from teams where id=? for update", Long.class, expected.id());
    if (!team(expected.id()).equals(expected))
      throw new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요. 다시 확인해 주세요");
  }

  public void saveRepos(long teamId, long userId, List<Repository> repos, Instant now) {
    requireSchema("github_repos", "team_repos");
    jdbc.update("delete from team_repos where team_id=?", teamId);
    for (var repo : repos) {
      long id = cacheRepo(repo, now);
      var at = Timestamp.from(now);
      jdbc.update(
          "insert into team_repos(team_id,repo_id,connected_by,created_at,updated_at) values (?,?,?,?,?)",
          teamId,
          id,
          userId,
          at,
          at);
    }
  }

  public long cacheRepo(Repository r, Instant now) {
    var at = Timestamp.from(now);
    return jdbc.queryForObject(
        """
                insert into github_repos(github_repo_id,owner_login,name,full_name,description,primary_language,stargazers_count,forks_count,html_url,is_private,is_fork,parent_full_name,default_branch,metadata_synced_at,created_at,updated_at)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                on conflict(github_repo_id) do update set owner_login=excluded.owner_login,name=excluded.name,full_name=excluded.full_name,description=excluded.description,
                  primary_language=excluded.primary_language,stargazers_count=excluded.stargazers_count,forks_count=excluded.forks_count,html_url=excluded.html_url,
                  is_private=excluded.is_private,is_fork=excluded.is_fork,parent_full_name=excluded.parent_full_name,default_branch=excluded.default_branch,
                  metadata_synced_at=excluded.metadata_synced_at,deleted_at=null,updated_at=excluded.updated_at returning id
                """,
        Long.class,
        r.id(),
        r.owner(),
        r.name(),
        r.fullName(),
        r.description(),
        r.language(),
        r.stars(),
        r.forks(),
        r.htmlUrl(),
        r.isPrivate(),
        r.isFork(),
        r.parentFullName(),
        r.defaultBranch(),
        at,
        at,
        at);
  }

  public List<Repository> repos(long teamId) {
    requireSchema("team_repos", "github_repos");
    return jdbc.query(
        """
                select r.* from team_repos tr join github_repos r on r.id=tr.repo_id
                where tr.team_id=? and r.deleted_at is null order by r.github_repo_id
                """,
        (r, n) ->
            new Repository(
                r.getLong("github_repo_id"),
                r.getString("owner_login"),
                r.getString("name"),
                r.getString("full_name"),
                r.getString("description"),
                r.getString("primary_language"),
                r.getInt("stargazers_count"),
                r.getInt("forks_count"),
                r.getString("html_url"),
                r.getBoolean("is_private"),
                r.getBoolean("is_fork"),
                r.getString("parent_full_name"),
                r.getString("default_branch")),
        teamId);
  }

  public void saveBoard(
      long teamId,
      long userId,
      GithubTeamSource.Project project,
      boolean created,
      String statusField,
      String startField,
      String dueField,
      Map<String, String> mapping,
      Instant now) {
    requireSchema("team_project_boards", "board_status_mappings");
    var at = Timestamp.from(now);
    long board =
        jdbc.queryForObject(
            """
                insert into team_project_boards(team_id,github_project_node_id,project_number,title,created_by_linker,status_field_id,start_date_field_id,due_date_field_id,connected_by,created_at,updated_at)
                values (?,?,?,?,?,?,?,?,?,?,?)
                on conflict(team_id) do update set github_project_node_id=excluded.github_project_node_id,project_number=excluded.project_number,
                title=excluded.title,created_by_linker=excluded.created_by_linker,status_field_id=excluded.status_field_id,start_date_field_id=excluded.start_date_field_id,
                due_date_field_id=excluded.due_date_field_id,connected_by=excluded.connected_by,updated_at=excluded.updated_at returning id
                """,
            Long.class,
            teamId,
            project.id(),
            project.number(),
            project.title(),
            created,
            statusField,
            startField,
            dueField,
            userId,
            at,
            at);
    jdbc.update("delete from board_status_mappings where board_id=?", board);
    var field =
        project.fields().stream().filter(f -> f.id().equals(statusField)).findFirst().orElseThrow();
    for (var option : field.options())
      jdbc.update(
          "insert into board_status_mappings(board_id,github_option_id,github_option_name,linker_status,created_at,updated_at) values (?,?,?,?,?,?)",
          board,
          option.id(),
          option.name(),
          mapping.getOrDefault(option.id(), "OTHER"),
          at,
          at);
  }

  public String boardId(long teamId) {
    requireSchema("team_project_boards");
    var ids =
        jdbc.queryForList(
            "select github_project_node_id from team_project_boards where team_id=?",
            String.class,
            teamId);
    return ids.isEmpty() ? null : ids.getFirst();
  }

  public void saveBasePermission(long teamId, String permission, Instant now) {
    jdbc.update(
        "update teams set org_base_permission=?,updated_at=? where id=?",
        permission,
        Timestamp.from(now),
        teamId);
  }

  public boolean boardCreatedByLinker(long teamId) {
    return Boolean.TRUE.equals(
        jdbc.queryForObject(
            "select created_by_linker from team_project_boards where team_id=?",
            Boolean.class,
            teamId));
  }

  public void requireActive(long userId) {
    if (!Boolean.TRUE.equals(
        jdbc.queryForObject(
            "select exists(select 1 from users where id=? and status='ACTIVE' and deleted_at is null)",
            Boolean.class,
            userId))) throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
  }

  /** Existing row revisions distinguish A→B→A edits without inventing schema columns. */
  public String setupRevision(long teamId) {
    String team =
        jdbc.queryForObject(
            "select extract(epoch from updated_at)::text from teams where id=?",
            String.class,
            teamId);
    String repos =
        jdbc.queryForObject(
            "select string_agg(id::text||':'||repo_id::text||':'||extract(epoch from updated_at)::text,',' order by id) from team_repos where team_id=?",
            String.class,
            teamId);
    String board =
        jdbc.queryForObject(
            "select string_agg(id::text||':'||extract(epoch from updated_at)::text,',') from team_project_boards where team_id=?",
            String.class,
            teamId);
    return team + "|" + repos + "|" + board;
  }
}
