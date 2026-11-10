package com.linker.backend.service.user;

import com.linker.backend.dto.team.request.*;
import com.linker.backend.dto.team.response.TeamSetupResponse;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.TeamAccess;
import com.linker.backend.global.security.TeamRole;
import com.linker.backend.integration.github.GithubAppClient;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.integration.github.GithubTeamSource.Project;
import com.linker.backend.integration.github.GithubUserAccessTokenSource;
import com.linker.backend.repository.team.TeamRepository;
import com.linker.backend.dto.team.response.TeamPersistenceView.Team;
import java.time.Clock;
import java.util.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Real role-specific setup use cases. Provider work is always outside the short write transaction.
 */
@Service("userTeamSetupService")
@Transactional(propagation = Propagation.NEVER)
public class TeamSetupService {
  private static final List<String> OPTION_NAMES =
      List.of("Todo", "In Progress", "Blocked", "Done");
  private static final List<String> STATUSES = List.of("TODO", "IN_PROGRESS", "BLOCKED", "DONE");
  private final TeamRepository teams;
  private final TeamAccess access;
  private final GithubAppClient app;
  private final GithubUserAccessTokenSource tokens;
  private final GithubTeamSource github;
  private final StringRedisTemplate redis;
  private final TeamSyncService sync;
  private final Clock clock;
  private final TransactionTemplate write;

  public TeamSetupService(
      TeamRepository teams,
      TeamAccess access,
      GithubAppClient app,
      GithubUserAccessTokenSource tokens,
      GithubTeamSource github,
      StringRedisTemplate redis,
      TeamSyncService sync,
      Clock clock,
      PlatformTransactionManager transactions) {
    this.teams = teams;
    this.access = access;
    this.app = app;
    this.tokens = tokens;
    this.github = github;
    this.redis = redis;
    this.sync = sync;
    this.clock = clock;
    write = new TransactionTemplate(transactions);
  }

  public TeamSetupResponse.Created create(AuthenticatedUser user, CreateTeamRequest command) {
    active(user);
    long installation;
    try {
      installation = Long.parseLong(command.installationId());
      if (installation <= 0) throw new NumberFormatException();
    } catch (RuntimeException exception) {
      throw invalid("설치 정보를 확인해 주세요");
    }
    if (command.name() == null || command.name().isBlank() || command.name().trim().length() > 255)
      throw invalid("팀 이름을 확인해 주세요");
    teams.requireSchema(
        "teams", "team_members", "github_installations", "chat_rooms", "chat_room_members");
    var verified = app.verifyUserInstallation(tokens.tokenFor(user.userId()), installation);
    github.organization(user.userId(), verified.orgId(), verified.login());
    var live = github.installation(installation);
    if (live == null || live.orgId() != verified.orgId() || live.suspended())
      throw new ApiException(403, "FORBIDDEN", "GitHub App 설치 상태를 다시 확인해 주세요");
    var authoritative =
        new com.linker.backend.dto.github.response.GithubInstallationView(
            verified.installationId(),
            verified.orgId(),
            live.login(),
            verified.avatarUrl(),
            live.repositorySelection());
    return teams.withOrganizationSetupLock(
        verified.orgId(),
        () ->
            write.execute(
                status -> {
                  if (!teams.lockActiveDeveloper(user.userId()))
                    throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
                  Long existing = teams.linkedOrg(authoritative.orgId());
                  if (existing != null) {
                    if (!teams.currentOwner(user.userId(), existing))
                      throw new ApiException(409, "STATE_CONFLICT", "이미 연결된 GitHub 조직이에요");
                    var current = teams.team(existing);
                    teams.assertUnchanged(current);
                    if ("ARCHIVED".equals(current.status()))
                      throw new ApiException(409, "STATE_CONFLICT", "보관된 팀의 연결을 확인해 주세요");
                    return teams.reconnect(
                        existing,
                        user.userId(),
                        authoritative,
                        "READ_ONLY".equals(current.status()) ? "ACTIVE" : current.status(),
                        clock.instant());
                  }
                  if (teams.countedTeams(user.userId()) >= PlanLimits.TEAMS_PER_USER_MAX)
                    throw new ApiException(
                        403,
                        "PLAN_LIMIT",
                        "팀은 " + PlanLimits.TEAMS_PER_USER_MAX + "개까지 참여할 수 있어요",
                        Map.of("reason", "teams"));
                  return teams.create(user.userId(), authoritative, command, clock.instant());
                }));
  }

  public TeamSetupResponse.Repos repos(AuthenticatedUser user, long id) {
    var team = authorized(user, id, TeamRole.Level.ADMIN, false);
    var repos = github.repositories(user.userId(), team.installationId(), team.orgId());
    // Installed-repo listing cannot establish how many org repos are inaccessible.
    return new TeamSetupResponse.Repos(
        repos.stream()
            .map(r -> new TeamSetupResponse.Repo(r.id(), r.name(), r.fullName(), r.isPrivate()))
            .toList(),
        null,
        "https://github.com/organizations/"
            + team.orgLogin()
            + "/settings/installations/"
            + team.installationId());
  }

  public void saveRepos(AuthenticatedUser user, long id, SaveTeamReposRequest command) {
    active(user);
    if (command.repoIds() == null
        || new HashSet<>(command.repoIds()).size() != command.repoIds().size()
        || command.repoIds().stream().anyMatch(v -> v == null || v <= 0))
      throw invalid("저장소를 다시 선택해 주세요");
    locked(
        id,
        () -> {
          var team = authorized(user, id, TeamRole.Level.OWNER, true);
          var allowed = github.repositories(user.userId(), team.installationId(), team.orgId());
          var selected = allowed.stream().filter(r -> command.repoIds().contains(r.id())).toList();
          if (selected.size() != command.repoIds().size())
            throw new ApiException(403, "FORBIDDEN", "App 접근이 허용된 저장소만 연결할 수 있어요");
          write.executeWithoutResult(
              status -> {
                authorized(user, id, TeamRole.Level.OWNER, true);
                teams.assertUnchanged(team);
                teams.saveRepos(id, user.userId(), selected, clock.instant());
              });
          sync.invalidate(id);
          return null;
        });
  }

  public TeamSetupResponse.Boards boards(AuthenticatedUser user, long id) {
    var team = authorized(user, id, TeamRole.Level.ADMIN, false);
    return new TeamSetupResponse.Boards(
        github.projects(user.userId(), team.orgId(), team.orgLogin()).stream()
            .map(
                project -> {
                  requireOwner(project, team);
                  var candidates =
                      project.fields().stream()
                          .filter(
                              f ->
                                  "SINGLE_SELECT".equals(f.dataType()) && "Status".equals(f.name()))
                          .toList();
                  var status = candidates.size() == 1 ? candidates.getFirst() : null;
                  return new TeamSetupResponse.Board(
                      project.id(),
                      project.title(),
                      project.cardCount(),
                      status == null
                          ? List.of()
                          : status.options().stream().map(GithubTeamSource.Option::name).toList(),
                      status == null
                          ? List.of()
                          : status.options().stream()
                              .map(
                                  o ->
                                      new TeamSetupResponse.Option(
                                          o.id(),
                                          o.name(),
                                          com.linker.backend.entity.team.type.BoardStatusColor
                                              .parse(o.color())
                                              .name()))
                              .toList());
                })
            .toList());
  }

  public TeamSetupResponse.BoardSaved board(
      AuthenticatedUser user, long id, SetupBoardRequest command) {
    active(user);
    return locked(
        id,
        () -> {
          var team = authorized(user, id, TeamRole.Level.ADMIN, true);
          teams.requireSchema("team_project_boards", "board_status_mappings");
          String key = "linker:team-setup:board:" + id;
          String selected = command.boardId();
          boolean created = command.mode() == SetupBoardRequest.Mode.NEW;
          boolean alreadyLinked = false;
          if (created) {
            String stored = redis.opsForValue().get(key);
            if ("UNCERTAIN".equals(stored))
              throw new ApiException(409, "STATE_CONFLICT", "보드 생성 결과를 확인하고 기존 보드를 선택해 주세요");
            String linked = teams.boardId(id);
            if (linked != null && !teams.boardCreatedByLinker(id))
              throw new ApiException(409, "STATE_CONFLICT", "기존에 연결한 보드를 선택해 주세요");
            alreadyLinked = linked != null;
            if (linked != null) selected = linked;
            else if (stored != null) selected = stored;
            else {
              var org = github.organization(user.userId(), team.orgId(), team.orgLogin());
              // clientMutationId is correlation only. Never retry an uncertain creation blindly.
              redis.opsForValue().set(key, "UNCERTAIN");
              var made =
                  github.createProject(user.userId(), org.nodeId(), "Linker", "linker-team-" + id);
              selected = made.id();
              redis.opsForValue().set(key, selected);
            }
          }
          if (selected == null || selected.isBlank()) throw invalid("보드를 선택해 주세요");
          var project = github.project(user.userId(), selected);
          requireOwner(project, team);
          var field = statusField(project);
          if (created
              && !field.options().stream()
                  .map(GithubTeamSource.Option::name)
                  .toList()
                  .equals(OPTION_NAMES)) {
            if (alreadyLinked || project.cardCount() > 0)
              throw new ApiException(409, "STATE_CONFLICT", "변경된 보드를 기존 보드로 선택하고 상태를 다시 연결해 주세요");
            github.updateStatus(user.userId(), field.id(), OPTION_NAMES);
            project = github.project(user.userId(), selected);
            requireOwner(project, team);
            field = statusField(project);
          }
          for (String name : List.of("Start date", "Due date")) {
            var named = project.fields().stream().filter(f -> name.equals(f.name())).toList();
            if (named.size() > 1 || named.stream().anyMatch(f -> !"DATE".equals(f.dataType())))
              throw invalid("보드 날짜 필드를 확인해 주세요");
            if (named.isEmpty()) {
              if (alreadyLinked)
                throw new ApiException(409, "STATE_CONFLICT", "변경된 보드를 기존 보드로 선택하고 날짜 필드를 확인해 주세요");
              github.createDateField(user.userId(), selected, name);
              project = github.project(user.userId(), selected);
              requireOwner(project, team);
            }
          }
          field = statusField(project);
          Map<String, String> mapping = new LinkedHashMap<>();
          if (created) {
            for (var option : field.options()) {
              int index = OPTION_NAMES.indexOf(option.name());
              if (index < 0) throw invalid("보드 상태를 확인해 주세요");
              mapping.put(option.id(), STATUSES.get(index));
            }
            if (!mapping.values().containsAll(STATUSES)) throw invalid("보드 상태를 확인해 주세요");
          } else {
            if (command.statusMapping() == null) throw invalid("상태 매핑이 필요해요");
            var optionIds = field.options().stream().map(GithubTeamSource.Option::id).toList();
            for (var entry : command.statusMapping().entrySet()) {
              if (!optionIds.contains(entry.getKey())
                  || (!STATUSES.contains(entry.getValue()) && !"OTHER".equals(entry.getValue())))
                throw invalid("상태 매핑을 확인해 주세요");
              mapping.put(entry.getKey(), entry.getValue());
            }
            if (!mapping.values().containsAll(STATUSES)) throw invalid("네 가지 상태를 모두 연결해 주세요");
          }
          String start = dateField(project, "Start date"), due = dateField(project, "Due date");
          var finished = project;
          var statusField = field;
          write.executeWithoutResult(
              status -> {
                authorized(user, id, TeamRole.Level.ADMIN, true);
                teams.assertUnchanged(team);
                teams.saveBoard(
                    id,
                    user.userId(),
                    finished,
                    created,
                    statusField.id(),
                    start,
                    due,
                    mapping,
                    clock.instant());
              });
          // An explicit existing-board selection can reconcile an uncertain create outcome.
          redis.opsForValue().set(key, selected);
          sync.invalidate(id);
          return new TeamSetupResponse.BoardSaved(project.id(), project.title());
        });
  }

  public TeamSetupResponse.Permission permission(AuthenticatedUser user, long id) {
    var team = authorized(user, id, TeamRole.Level.OWNER, false);
    var org = github.organization(user.userId(), team.orgId(), team.orgLogin());
    // GitHub App responses may omit this owner-only advisory field. Unknown is not a
    // write grant: preserve null in DB and show the existing permission guidance.
    String permission =
        org.basePermission() == null || org.basePermission().isBlank()
            ? null
            : org.basePermission().toLowerCase(Locale.ROOT);
    if (permission != null && !List.of("none", "read", "write", "admin").contains(permission))
      throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub 조직 기본 권한을 확인해 주세요");
    write.executeWithoutResult(
        status -> {
          authorized(user, id, TeamRole.Level.OWNER, false);
          teams.assertUnchanged(team);
          teams.saveBasePermission(id, permission, clock.instant());
        });
    return new TeamSetupResponse.Permission(
        permission == null ? "UNKNOWN" : permission.toUpperCase(Locale.ROOT),
        "https://github.com/organizations/" + org.login() + "/settings/member_privileges");
  }

  public TeamSetupResponse.Complete complete(AuthenticatedUser user, long id, boolean retry) {
    active(user);
    return locked(
        id,
        () -> {
          // This returns only after commit. Redis enqueue and all worker HTTP are outside it.
          write.executeWithoutResult(
              status -> {
                var team = authorized(user, id, TeamRole.Level.OWNER, true);
                teams.assertUnchanged(team);
                if (teams.repos(id).isEmpty() || teams.boardId(id) == null)
                  throw invalid("저장소와 보드를 먼저 연결해 주세요");
              });
          return sync.enqueue(id, user.userId(), retry);
        });
  }

  private Team authorized(AuthenticatedUser user, long id, TeamRole.Level role, boolean writable) {
    if (user == null || user.userType() != UserType.DEVELOPER)
      throw new ApiException(403, "DEVELOPER_ONLY", "개발자만 사용할 수 있어요");
    if (!access.hasRole(user.userId(), id, role))
      throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요");
    var team = teams.team(id);
    if (writable) teams.requireActive(user.userId());
    if (writable && !List.of("ACTIVE", "COMPLETED").contains(team.status()))
      throw new ApiException(403, "FORBIDDEN", "읽기 전용 팀에서는 설정을 변경할 수 없어요");
    return team;
  }

  private static void active(AuthenticatedUser user) {
    if (user == null || user.userType() != UserType.DEVELOPER || user.status() != UserStatus.ACTIVE)
      throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
  }

  private static void requireOwner(Project project, Team team) {
    if (project.orgId() != team.orgId())
      throw new ApiException(403, "FORBIDDEN", "이 팀 조직의 보드를 선택해 주세요");
  }

  private static GithubTeamSource.Field statusField(Project project) {
    var fields =
        project.fields().stream()
            .filter(f -> "Status".equals(f.name()) && "SINGLE_SELECT".equals(f.dataType()))
            .toList();
    if (fields.size() != 1) throw invalid("보드 상태 필드를 확인해 주세요");
    return fields.getFirst();
  }

  private static String dateField(Project project, String name) {
    return project.fields().stream()
        .filter(f -> name.equals(f.name()) && "DATE".equals(f.dataType()))
        .map(GithubTeamSource.Field::id)
        .findFirst()
        .orElseThrow(() -> invalid("보드 날짜 필드를 확인해 주세요"));
  }

  private <T> T locked(long id, java.util.function.Supplier<T> operation) {
    try {
      return teams.withTeamSetupLock(id, operation);
    } catch (org.springframework.data.redis.RedisConnectionFailureException exception) {
      throw new ApiException(503, "SERVICE_UNAVAILABLE", "팀 설정 대기열 연결을 확인해 주세요");
    }
  }

  private static ApiException invalid(String message) {
    return new ApiException(400, "VALIDATION_ERROR", message);
  }
}
