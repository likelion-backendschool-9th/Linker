package com.linker.backend;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.global.security.TeamAccess;
import com.linker.backend.global.security.TeamRole;
import com.linker.backend.integration.github.*;
import com.linker.backend.integration.github.GithubTeamSource.*;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.github.GithubWebhookDeliveryRepository;
import com.linker.backend.repository.issue.IssueRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.TeamSyncService;
import jakarta.servlet.http.Cookie;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

/** Real Flyway history (including B V20) plus C's preparation, in isolated containers only. */
@SpringBootTest(properties = "spring.jpa.show-sql=false")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Testcontainers
class TeamSetupIntegrationTest {
  static final RsaMaterial KEYS = RsaMaterial.generate();
  @Container static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:16-alpine");

  @Container
  static final GenericContainer<?> REDIS =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
    r.add("spring.data.redis.host", REDIS::getHost);
    r.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    r.add("linker.session.jwt-private-key", KEYS::privatePem);
    r.add("linker.session.jwt-public-key", KEYS::publicPem);
    r.add("linker.webhook.consumer-enabled", () -> "false");
    r.add("linker.github.webhook-secret", () -> "team-test-secret");
    r.add("linker.github.app.id", () -> "123");
    r.add("linker.github.app.slug", () -> "team-test-app");
    r.add("linker.issues.sync-enabled", () -> "false");
    r.add("linker.issues.webhook-enabled", () -> "true");
    r.add("linker.team-setup.worker-enabled", () -> "false");
    r.add("linker.team-setup.webhook-enabled", () -> "true");
  }

  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired ObjectMapper json;
  @Autowired UserRepository users;
  @Autowired AuthService sessions;
  @Autowired StringRedisTemplate redis;
  @Autowired TeamAccess access;
  @Autowired TeamSyncService sync;
  @Autowired IssueRepository issueRepository;
  @Autowired com.linker.backend.repository.team.TeamRepository teamRows;
  @Autowired com.linker.backend.repository.team.TeamMemberRepository memberRows;
  @Autowired jakarta.persistence.EntityManager entityManager;
  @Autowired GithubWebhookService webhooks;
  @Autowired GithubWebhookDeliveryRepository deliveries;
  @MockitoBean GithubAppClient app;
  @MockitoBean GithubUserAccessTokenSource tokens;
  @MockitoBean GithubTeamSource github;
  @MockitoBean GithubIssueClient issues;
  final AtomicInteger creations = new AtomicInteger();
  final Map<String, Project> projects = new HashMap<>();
  final Repository repo =
      new Repository(
          900,
          "org",
          "api",
          "org/api",
          null,
          "Java",
          0,
          0,
          "https://github.com/org/api",
          true,
          false,
          null,
          "main");

  @BeforeEach
  void clean() {
    jdbc.execute("truncate users,github_repos restart identity cascade");
    try (var connection = redis.getConnectionFactory().getConnection()) {
      connection.serverCommands().flushDb();
    }
    creations.set(0);
    projects.clear();
    when(tokens.tokenFor(anyLong()))
        .thenAnswer(
            invocation -> {
              outside();
              return "synthetic-user-token";
            });
    when(app.verifyUserInstallation(anyString(), anyLong()))
        .thenAnswer(
            invocation -> {
              outside();
              return new GithubInstallationView(invocation.getArgument(1), 500, "org", null);
            });
    when(app.installationReadToken(anyLong()))
        .thenAnswer(
            invocation -> {
              outside();
              return "synthetic-installation-token";
            });
    when(github.installation(anyLong()))
        .thenAnswer(
            invocation -> {
              outside();
              return new Installation(invocation.getArgument(0), 500, "org", "ALL", false);
            });
    when(github.organization(anyLong(), eq(500L), eq("org")))
        .thenAnswer(
            invocation -> {
              outside();
              return new Organization(500, "ORG_500", "org", null, "read");
            });
    when(github.repositories(anyLong(), anyLong(), eq(500L)))
        .thenAnswer(
            invocation -> {
              outside();
              return List.of(repo);
            });
    when(github.projects(anyLong(), eq(500L), eq("org")))
        .thenAnswer(
            invocation -> {
              outside();
              return List.copyOf(projects.values());
            });
    when(github.createProject(anyLong(), eq("ORG_500"), eq("Linker"), anyString()))
        .thenAnswer(
            invocation -> {
              outside();
              creations.incrementAndGet();
              var p =
                  new Project(
                      "P_1",
                      500,
                      1,
                      "Linker",
                      0,
                      List.of(
                          new Field(
                              "F_STATUS",
                              "Status",
                              "SINGLE_SELECT",
                              List.of(
                                  new Option("o1", "Todo"),
                                  new Option("o2", "In Progress"),
                                  new Option("o3", "Done")))));
              projects.put(p.id(), p);
              return p;
            });
    when(github.project(anyLong(), anyString()))
        .thenAnswer(
            invocation -> {
              outside();
              return projects.get(invocation.getArgument(1));
            });
    doAnswer(
            invocation -> {
              outside();
              var p = projects.get("P_1");
              var options = new ArrayList<Option>();
              int i = 0;
              for (String name : (List<String>) invocation.getArgument(2))
                options.add(new Option("opt" + i++, name));
              projects.put(
                  p.id(),
                  new Project(
                      p.id(),
                      p.orgId(),
                      p.number(),
                      p.title(),
                      p.cardCount(),
                      List.of(new Field("F_STATUS", "Status", "SINGLE_SELECT", options))));
              return null;
            })
        .when(github)
        .updateStatus(anyLong(), anyString(), anyList());
    doAnswer(
            invocation -> {
              outside();
              var p = projects.get(invocation.getArgument(1));
              String name = invocation.getArgument(2);
              var fields = new ArrayList<>(p.fields());
              fields.add(new Field("F_" + name, name, "DATE", List.of()));
              projects.put(
                  p.id(),
                  new Project(p.id(), p.orgId(), p.number(), p.title(), p.cardCount(), fields));
              return null;
            })
        .when(github)
        .createDateField(anyLong(), anyString(), anyString());
    when(issues.project(any(), anyString()))
        .thenAnswer(
            invocation -> {
              outside();
              return Map.of();
            });
    when(issues.list(any(), anyString()))
        .thenAnswer(
            invocation -> {
              outside();
              return List.of();
            });
    when(github.pullRequests(anyLong(), any()))
        .thenAnswer(
            invocation -> {
              outside();
              return List.of(
                  new PullRequest(
                      800,
                      1,
                      "PR",
                      "OPEN",
                      false,
                      "owner",
                      "https://github.com/org/api/pull/1",
                      null,
                      null,
                      Instant.now()));
            });
    when(github.memberIds(anyLong(), anyString(), eq(500L)))
        .thenAnswer(
            invocation -> {
              outside();
              return List.of(700L);
            });
  }

  @Test
  void createsOnlyOneTeamOwnerAndChatAcrossRetriesAndDeniesOtherAccounts() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    long team = create(session);
    assertThat(create(session)).isEqualTo(team);
    assertThat(jdbc.queryForObject("select count(*) from teams", Long.class)).isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from chat_rooms where team_id=?", Long.class, team))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from chat_room_members", Long.class))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "select repository_selection from github_installations", String.class))
        .isEqualTo("ALL");
    assertThat(access.hasRole(owner.getId(), team, TeamRole.Level.OWNER)).isTrue();
    mvc.perform(
            post("/api/v1/user/teams")
                .cookie(cookie(user("outsider", UserType.DEVELOPER)))
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody()))
        .andExpect(status().isConflict());
    mvc.perform(
            post("/api/v1/user/teams")
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody()))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/v1/user/teams")
                .cookie(cookie(user("recruiter", UserType.RECRUITER)))
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody()))
        .andExpect(status().isForbidden());
  }

  @Test
  void linksActualReposAndFieldsAndQueuesCsInitialSyncAfterCommit() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    identity(owner, 700);
    var session = cookie(owner);
    long team = create(session);
    mvc.perform(get("/api/v1/user/teams/{id}/setup/repos", team).cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].private").value(true))
        .andExpect(jsonPath("$.notInstalledCount").doesNotExist());
    link(session, team);
    board(session, team);
    assertThat(issueRepository.context(team).installationId()).isEqualTo(42);
    assertThat(issueRepository.context(team).board().statuses().values())
        .containsExactlyInAnyOrder("TODO", "IN_PROGRESS", "BLOCKED", "DONE");
    assertThat(issueRepository.context(team).repos().getFirst().githubId()).isEqualTo(900);
    mvc.perform(get("/api/v1/user/teams/{id}/setup/permission-check", team).cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.basePermission").value("READ"));
    complete(session, team)
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.state").value("QUEUED"));
    verify(issues, never()).list(any(), anyString());
    sync.drain();
    complete(session, team)
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.queued").value(false))
        .andExpect(jsonPath("$.state").value("COMPLETED"));
    verify(issues, times(1)).list(any(), eq("synthetic-installation-token"));
    assertThat(jdbc.queryForObject("select count(*) from pull_requests", Long.class)).isEqualTo(1);
  }

  @Test
  void roleAndRepositoryChecksRejectForeignWritesAndReadOnlyMutations() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    long team = create(session);
    var outsider = user("other", UserType.DEVELOPER);
    var other = cookie(outsider);
    mvc.perform(get("/api/v1/user/teams/{id}/setup/repos", team).cookie(other))
        .andExpect(status().isForbidden());
    mvc.perform(
            put("/api/v1/user/teams/{id}/setup/repos", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"repoIds\":[901]}"))
        .andExpect(status().isForbidden());
    jdbc.update("update teams set status='READ_ONLY',read_only_since=now() where id=?", team);
    mvc.perform(
            put("/api/v1/user/teams/{id}/setup/repos", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"repoIds\":[900]}"))
        .andExpect(status().isForbidden());
    assertThat(jdbc.queryForObject("select count(*) from team_repos", Long.class)).isZero();
  }

  @Test
  void uncertainCreationDoesNotCreateAnotherBoardOnRetry() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    when(github.createProject(anyLong(), anyString(), anyString(), anyString()))
        .thenThrow(new ApiException(503, "SERVICE_UNAVAILABLE", "모의 응답 유실"));
    mvc.perform(
            post("/api/v1/user/teams/{id}/setup/board", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"NEW\"}"))
        .andExpect(status().isServiceUnavailable());
    mvc.perform(
            post("/api/v1/user/teams/{id}/setup/board", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"NEW\"}"))
        .andExpect(status().isConflict());
    verify(github, times(1)).createProject(anyLong(), anyString(), anyString(), anyString());
  }

  @Test
  void alreadyLinkedBoardRetriesReuseTheBoardAndMissingFields() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    board(session, team);
    board(session, team);
    assertThat(creations.get()).isEqualTo(1);
    verify(github, times(2)).createDateField(anyLong(), anyString(), anyString());
    assertThat(jdbc.queryForObject("select count(*) from team_project_boards", Long.class))
        .isEqualTo(1);
  }

  @Test
  void createdOwnerIsVisibleToAsWithdrawalCheckAndCannotWithdraw() throws Exception {
    var session = cookie(user("owner", UserType.DEVELOPER));
    long team = create(session);
    mvc.perform(get("/api/v1/user/me/withdrawal-check").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownedTeams[0].id").value(team));
    mvc.perform(post("/api/v1/user/me/withdrawal").cookie(session))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("OWNED_TEAMS_EXIST"));
  }

  @Test
  void AsWithdrawalRevokesTeamAccessEvenWhenTheMembershipHistoryRemains() throws Exception {
    long team = create(cookie(user("owner", UserType.DEVELOPER)));
    var member = user("member", UserType.DEVELOPER);
    join(team, member, "MEMBER", "MEMBER");
    var session = cookie(member);
    assertThat(access.hasRole(member.getId(), team, TeamRole.Level.MEMBER)).isTrue();
    mvc.perform(post("/api/v1/user/me/withdrawal").cookie(session)).andExpect(status().isOk());
    assertThat(access.hasRole(member.getId(), team, TeamRole.Level.MEMBER)).isFalse();
    mvc.perform(
            post("/api/v1/user/teams")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody()))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void retryDoesNotOverwriteStatusOptionsChangedOnAnAlreadyLinkedBoard() throws Exception {
    var session = cookie(user("owner", UserType.DEVELOPER));
    long team = create(session);
    link(session, team);
    board(session, team);
    var original = projects.get("P_1");
    var fields = new ArrayList<>(original.fields());
    fields.set(
        0,
        new Field(
            "F_STATUS",
            "Status",
            "SINGLE_SELECT",
            List.of(new Option("custom", "Waiting for review"))));
    projects.put(
        original.id(),
        new Project(
            original.id(), original.orgId(), original.number(), original.title(), 1, fields));

    mvc.perform(
            post("/api/v1/user/teams/{id}/setup/board", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"NEW\"}"))
        .andExpect(status().isConflict());

    verify(github, times(1)).updateStatus(anyLong(), anyString(), anyList());
    verify(github, times(2)).createDateField(anyLong(), anyString(), anyString());
    assertThat(projects.get("P_1").fields().getFirst().options().getFirst().name())
        .isEqualTo("Waiting for review");
    assertThat(jdbc.queryForObject("select count(*) from board_status_mappings", Long.class))
        .isEqualTo(4);
  }

  @Test
  void dbRoleChecksRespectCurrentRolesLeaveAndArchivedHistoryOnly() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    long team = create(cookie(owner));
    var admin = user("admin", UserType.DEVELOPER);
    join(team, admin, "ADMIN", "MEMBER");
    var member = user("member", UserType.DEVELOPER);
    join(team, member, "MEMBER", "INVITED");
    assertThat(access.hasRole(admin.getId(), team, TeamRole.Level.ADMIN)).isTrue();
    assertThat(access.hasRole(admin.getId(), team, TeamRole.Level.OWNER)).isFalse();
    assertThat(access.hasRole(member.getId(), team, TeamRole.Level.MEMBER)).isTrue();
    assertThat(access.hasRole(member.getId(), team, TeamRole.Level.ADMIN)).isFalse();
    jdbc.update(
        "update team_members set left_at=now(),leave_type='LEFT' where team_id=? and user_id=?",
        team,
        admin.getId());
    assertThat(access.hasRole(admin.getId(), team, TeamRole.Level.MEMBER)).isFalse();
    jdbc.update("update teams set status='READ_ONLY' where id=?", team);
    assertThat(access.hasRole(owner.getId(), team, TeamRole.Level.MEMBER)).isTrue();
    jdbc.update("update teams set status='ARCHIVED' where id=?", team);
    assertThat(access.hasRole(owner.getId(), team, TeamRole.Level.MEMBER)).isFalse();
    mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].status").value("ARCHIVED"));
  }

  @Test
  void aPartialRepoChangeInvalidatesTheQueuedContextInsteadOfSyncingTheWrongSetup()
      throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    board(session, team);
    complete(session, team).andExpect(status().isAccepted());
    mvc.perform(
            put("/api/v1/user/teams/{id}/setup/repos", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"repoIds\":[]}"))
        .andExpect(status().isNoContent());
    sync.drain();
    verify(issues, never()).project(any(), anyString());
    assertThat(redis.opsForZSet().size("linker:team-setup:due")).isZero();
  }

  @Test
  void failedJobReportsItsStepAndOnlyExplicitRetryRestartsIt() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    board(session, team);
    when(issues.project(any(), anyString()))
        .thenThrow(new ApiException(503, "SERVICE_UNAVAILABLE", "모의 실패"));
    complete(session, team).andExpect(status().isAccepted());
    for (int n = 0; n < 3; n++) {
      for (String member : redis.opsForZSet().range("linker:team-setup:due", 0, -1))
        redis.opsForZSet().add("linker:team-setup:due", member, 0);
      sync.drain();
    }
    complete(session, team)
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.queued").value(false))
        .andExpect(jsonPath("$.state").value("FAILED"))
        .andExpect(jsonPath("$.failedStep").value("ISSUES"));
    doReturn(Map.of()).when(issues).project(any(), anyString());
    mvc.perform(
            post("/api/v1/user/teams/{id}/setup/complete", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"retry\":true}"))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.state").value("QUEUED"));
    sync.drain();
    complete(session, team).andExpect(jsonPath("$.state").value("COMPLETED"));
  }

  @Test
  void orgSyncPreservesInviteesButRemovesFormerOrgMembersAndClosesChatMembership()
      throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    identity(owner, 700);
    long team = create(cookie(owner));
    var former = user("former", UserType.DEVELOPER);
    identity(former, 701);
    join(team, former, "MEMBER", "MEMBER");
    var invited = user("invited", UserType.DEVELOPER);
    identity(invited, 702);
    join(team, invited, "MEMBER", "INVITED");
    sync.organizationChanged(42, 500, "org");
    assertThat(access.hasRole(former.getId(), team, TeamRole.Level.MEMBER)).isFalse();
    assertThat(access.hasRole(invited.getId(), team, TeamRole.Level.MEMBER)).isTrue();
    assertThat(
            jdbc.queryForObject(
                "select leave_type from team_members where user_id=?",
                String.class,
                former.getId()))
        .isEqualTo("ORG_REMOVED");
    assertThat(
            jdbc.queryForObject(
                "select left_at is not null from chat_room_members where user_id=?",
                Boolean.class,
                former.getId()))
        .isTrue();
    assertThat(jdbc.queryForObject("select count(*) from notifications", Long.class)).isEqualTo(2);
    sync.organizationChanged(42, 500, "org");
    assertThat(jdbc.queryForObject("select count(*) from notifications", Long.class)).isEqualTo(2);
  }

  @Test
  void signedInstallationDeletionReinstallAndThirtyDayArchiveUseTheRealIngress() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    long team = create(cookie(owner));
    when(github.installation(42)).thenReturn(null);
    String body =
        "{\"action\":\"deleted\",\"installation\":{\"id\":42,\"account\":{\"id\":500,\"type\":\"Organization\"}}}";
    String delivery = "setup-deleted";
    signedWebhook(delivery, "installation", body);
    webhooks.dispatch(deliveries.findByDeliveryId(delivery).orElseThrow().getId());
    assertThat(jdbc.queryForObject("select status from teams where id=?", String.class, team))
        .isEqualTo("READ_ONLY");
    assertThat(jdbc.queryForObject("select count(*) from notifications", Long.class)).isEqualTo(1);
    signedWebhook(delivery, "installation", body);
    assertThat(jdbc.queryForObject("select count(*) from notifications", Long.class)).isEqualTo(1);
    when(github.installation(43)).thenReturn(new Installation(43, 500, "org", "ALL", false));
    sync.installationChanged(43, 500);
    assertThat(jdbc.queryForObject("select status from teams where id=?", String.class, team))
        .isEqualTo("ACTIVE");
    sync.installationChanged(
        42, 500); // Late deletion of replaced id cannot close the new connection.
    assertThat(jdbc.queryForObject("select status from teams where id=?", String.class, team))
        .isEqualTo("ACTIVE");
    when(github.installation(43)).thenReturn(null);
    sync.installationChanged(43, 500);
    jdbc.update("update teams set read_only_since=now()-interval '29 days' where id=?", team);
    sync.archiveReadOnly();
    assertThat(jdbc.queryForObject("select status from teams where id=?", String.class, team))
        .isEqualTo("READ_ONLY");
    jdbc.update("update teams set read_only_since=now()-interval '30 days' where id=?", team);
    sync.archiveReadOnly();
    assertThat(jdbc.queryForObject("select status from teams where id=?", String.class, team))
        .isEqualTo("ARCHIVED");
  }

  @Test
  void publishesBothBSetupAndPreservedCContracts() throws Exception {
    var response =
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams'].post.tags[0]").value("p08-team-create"))
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams/{teamId}/issues'].get.tags[0]")
                    .value("p11-issue-list"))
            .andExpect(
                jsonPath("$.paths['/api/v1/user/team-setup/installations/verify'].post.tags[0]")
                    .value("p00-common"))
            .andReturn();
    Files.createDirectories(Path.of("build"));
    Files.writeString(
        Path.of("build/team-setup-openapi.json"), response.getResponse().getContentAsString());
  }

  @Test
  void organizationRenameKeepsRepositoryIdentityAndUpdatesCsReadContext() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    identity(owner, 700);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    board(session, team);
    long repoId =
        jdbc.queryForObject("select id from github_repos where github_repo_id=900", Long.class);
    sync.organizationChanged(42, 500, "new-org");
    assertThat(
            jdbc.queryForObject("select id from github_repos where github_repo_id=900", Long.class))
        .isEqualTo(repoId);
    assertThat(
            jdbc.queryForObject(
                "select full_name from github_repos where id=?", String.class, repoId))
        .isEqualTo("new-org/api");
    assertThat(issueRepository.context(team).repos().getFirst().owner()).isEqualTo("new-org");
  }

  @Test
  void deletedNotificationRecipientCannotPreventAnUninstalledTeamBecomingReadOnly()
      throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    long team = create(cookie(owner));
    jdbc.update("update users set status='DELETED',deleted_at=now() where id=?", owner.getId());
    when(github.installation(42)).thenReturn(null);
    sync.installationChanged(42, 500);
    assertThat(jdbc.queryForObject("select status from teams where id=?", String.class, team))
        .isEqualTo("READ_ONLY");
    assertThat(jdbc.queryForObject("select count(*) from notifications", Long.class)).isZero();
  }

  @Test
  void signedIssueWebhookUsesBConnectionsAndRealTeamAccessToExposeCsCache() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    identity(owner, 700);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    board(session, team);
    var issue =
        new IssueSource.Issue(
            1234,
            "I_1234",
            8,
            "B와 C 연결 확인",
            "OPEN",
            "owner",
            "https://github.com/org/api/issues/8",
            Instant.now(),
            null,
            List.of(new IssueSource.Assignee(700, "owner")),
            List.of());
    when(issues.list(any(), anyString()))
        .thenAnswer(
            call -> {
              outside();
              return List.of(issue);
            });
    when(issues.project(any(), anyString()))
        .thenAnswer(
            call -> {
              outside();
              return Map.of(
                  "I_1234",
                  new IssueSource.ProjectItem(
                      "ITEM_1",
                      "I_1234",
                      "org/api",
                      "TODO",
                      LocalDate.of(2026, 11, 1),
                      LocalDate.of(2026, 11, 20),
                      false));
            });
    signedWebhook(
        "setup-issue-opened",
        "issues",
        "{\"action\":\"opened\",\"installation\":{\"id\":42},\"organization\":{\"id\":500},\"repository\":{\"id\":900},\"issue\":{\"id\":1234}}");
    webhooks.dispatch(deliveries.findByDeliveryId("setup-issue-opened").orElseThrow().getId());
    assertThat(
            jdbc.queryForObject(
                "select title from issues where github_issue_id=1234", String.class))
        .isEqualTo("B와 C 연결 확인");
    mvc.perform(get("/api/v1/user/teams/{id}/issues", team).cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].title").value("B와 C 연결 확인"))
        .andExpect(jsonPath("$.items[0].dueDate").value("2026-11-20"));
    mvc.perform(get("/api/v1/user/me/teams").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].openIssueCount").value(1));
  }

  @Test
  void pendingInstallRequiresProviderEvidenceAndConsumedStateCannotBeReused() throws Exception {
    var session = cookie(user("requester", UserType.DEVELOPER));
    String state = installState(session);
    when(github.hasPendingInstallationRequest(anyLong())).thenReturn(false);
    String request = "{\"setupAction\":\"request\",\"state\":\"" + state + "\"}";
    mvc.perform(
            post("/api/v1/user/team-setup/installations/verify")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(request))
        .andExpect(status().isForbidden());
    when(github.hasPendingInstallationRequest(anyLong())).thenReturn(true);
    mvc.perform(
            post("/api/v1/user/team-setup/installations/verify")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(request))
        .andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/v1/user/team-setup/installations/verify")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.replace(state, installState(session))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.result").value("REQUESTED_FROM_OWNER"))
        .andExpect(jsonPath("$.installationId").doesNotExist());
    assertThat(jdbc.queryForObject("select count(*) from teams", Long.class)).isZero();
  }

  @Test
  void alreadyLinkedResultDoesNotDisclosePrivateTeamIdToOtherOrgMembers() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var own = cookie(owner);
    long team = create(own);
    var outsider = cookie(user("outsider", UserType.DEVELOPER));
    mvc.perform(
            post("/api/v1/user/team-setup/installations/verify")
                .cookie(outsider)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"installationId\":\"42\",\"setupAction\":\"install\",\"state\":\""
                        + installState(outsider)
                        + "\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.result").value("ALREADY_LINKED"))
        .andExpect(jsonPath("$.teamId").doesNotExist());
    mvc.perform(
            post("/api/v1/user/team-setup/installations/verify")
                .cookie(own)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"installationId\":\"42\",\"state\":\"" + installState(own) + "\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.teamId").value(team));
  }

  private String installState(Cookie session) throws Exception {
    var result =
        mvc.perform(get("/api/v1/user/team-setup/install-url").cookie(session))
            .andExpect(status().isOk())
            .andReturn();
    return json.readTree(result.getResponse().getContentAsString()).path("state").asString("");
  }

  @Test
  void aRepeatedConfigurationCannotReuseAnOlderCompletedSnapshot() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    identity(owner, 700);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    board(session, team);
    complete(session, team).andExpect(jsonPath("$.state").value("QUEUED"));
    sync.drain();
    complete(session, team).andExpect(jsonPath("$.state").value("COMPLETED"));
    link(session, team); // Same repo selection, new committed linkage revision.
    complete(session, team).andExpect(jsonPath("$.state").value("QUEUED"));
    sync.drain();
    verify(issues, times(2)).list(any(), anyString());
  }

  @Test
  void membershipCapIsCheckedFromDbAndArchivedTeamsDoNotConsumeIt() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    for (int i = 0; i < 10; i++) seedMembership(owner, 1000 + i, "ACTIVE");
    mvc.perform(
            post("/api/v1/user/teams")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("PLAN_LIMIT"));
    assertThat(
            jdbc.queryForObject("select count(*) from teams where github_org_id=500", Long.class))
        .isZero();
    jdbc.update("update teams set status='ARCHIVED' where github_org_id=1000");
    create(session);
    mvc.perform(get("/api/v1/user/me/teams").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.teamCount").value(10))
        .andExpect(jsonPath("$.items.length()").value(11));
  }

  @Test
  void simultaneousDifferentOrgCreatesCannotBypassThePersonalCap() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    for (int i = 0; i < 9; i++) seedMembership(owner, 1000 + i, "ACTIVE");
    when(app.verifyUserInstallation(anyString(), anyLong()))
        .thenAnswer(
            call -> {
              outside();
              long id = call.getArgument(1);
              return new GithubInstallationView(id, id == 42 ? 500 : 501, "org", null);
            });
    when(github.installation(anyLong()))
        .thenAnswer(
            call -> {
              outside();
              long id = call.getArgument(0);
              return new Installation(id, id == 42 ? 500 : 501, "org", "ALL", false);
            });
    when(github.organization(anyLong(), anyLong(), eq("org")))
        .thenAnswer(
            call -> {
              outside();
              return new Organization(call.getArgument(1), "ORG", "org", null, "read");
            });
    try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var start = new java.util.concurrent.CountDownLatch(1);
      var results =
          executor.invokeAll(
              List.<java.util.concurrent.Callable<Integer>>of(
                  () -> {
                    start.countDown();
                    return mvc.perform(
                            post("/api/v1/user/teams")
                                .cookie(session)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(createBody()))
                        .andReturn()
                        .getResponse()
                        .getStatus();
                  },
                  () -> {
                    start.await();
                    return mvc.perform(
                            post("/api/v1/user/teams")
                                .cookie(session)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(createBody().replace("42", "43")))
                        .andReturn()
                        .getResponse()
                        .getStatus();
                  }));
      assertThat(List.of(results.get(0).get(), results.get(1).get()))
          .containsExactlyInAnyOrder(201, 403);
    }
    assertThat(jdbc.queryForObject("select count(*) from teams", Long.class)).isEqualTo(10);
  }

  @Test
  void existingBoardsUseOptionIdsAndKeepUnmappedOptionsAsOther() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    projects.put(
        "P_1",
        new Project(
            "P_1",
            500,
            8,
            "Existing",
            15,
            List.of(
                new Field(
                    "F_STATUS",
                    "Status",
                    "SINGLE_SELECT",
                    List.of(
                        new Option("a", "Backlog"),
                        new Option("b", "Doing"),
                        new Option("c", "Waiting"),
                        new Option("d", "Shipped"),
                        new Option("e", "Unmapped"))))));
    mvc.perform(get("/api/v1/user/teams/{id}/setup/boards", team).cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].cardCount").value(15))
        .andExpect(jsonPath("$.items[0].statusOptions[0].id").value("a"));
    String command =
        "{\"mode\":\"EXISTING\",\"boardId\":\"P_1\",\"statusMapping\":{\"a\":\"TODO\",\"b\":\"IN_PROGRESS\",\"c\":\"BLOCKED\",\"d\":\"DONE\"}}";
    mvc.perform(
            post("/api/v1/user/teams/{id}/setup/board", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(command))
        .andExpect(status().isOk());
    assertThat(issueRepository.context(team).board().statuses().get("e")).isEqualTo("OTHER");
    verify(github, never()).updateStatus(anyLong(), anyString(), anyList());
    mvc.perform(
            post("/api/v1/user/teams/{id}/setup/board", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"NEW\"}"))
        .andExpect(status().isConflict());
  }

  @Test
  void foreignOrgBoardsAreRejectedBeforeFieldMutations() throws Exception {
    var owner = user("owner", UserType.DEVELOPER);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    projects.put("FOREIGN", new Project("FOREIGN", 999, 1, "Other", 0, List.of()));
    mvc.perform(
            post("/api/v1/user/teams/{id}/setup/board", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"EXISTING\",\"boardId\":\"FOREIGN\",\"statusMapping\":{}}"))
        .andExpect(status().isForbidden());
    verify(github, never()).updateStatus(anyLong(), anyString(), anyList());
    verify(github, never()).createDateField(anyLong(), anyString(), anyString());
  }

  @Test
  void jpaConnectionProjectsTheSameIdsAndFieldsAsCsExistingContext() throws Exception {
    var owner = user("jpa-owner", UserType.DEVELOPER);
    var session = cookie(owner);
    long id = create(session);
    assertThat(teamRows.findConnection(id).orElseThrow().boardId()).isNull();
    assertThat(teamRows.findOwnedTeams(owner.getId()))
        .extracting(item -> item.id())
        .containsExactly(id);
    link(session, id);
    board(session, id);

    var existing = issueRepository.context(id);
    var connection = teamRows.findConnection(id).orElseThrow();
    assertThat(connection.installationId()).isEqualTo(existing.installationId()).isEqualTo(42);
    assertThat(connection.githubOrgId()).isEqualTo(existing.orgId());
    assertThat(connection.projectNodeId()).isEqualTo(existing.board().nodeId());
    assertThat(connection.statusFieldId()).isEqualTo(existing.board().statusField());
    assertThat(connection.startDateFieldId()).isEqualTo(existing.board().startField());
    assertThat(connection.dueDateFieldId()).isEqualTo(existing.board().dueField());
    assertThat(connection.status().name()).isEqualTo(existing.status());
    assertThat(teamRows.findLinkedRepos(id)).hasSize(1);
    assertThat(teamRows.findLinkedRepos(id).getFirst().githubRepoId()).isEqualTo(900);
    assertThat(teamRows.findLinkedRepos(id).getFirst().repoId())
        .isEqualTo(existing.repos().getFirst().id());
    var mapping =
        teamRows.findBoardStatusMappings(connection.boardId()).stream()
            .collect(
                java.util.stream.Collectors.toMap(
                    item -> item.githubOptionId(), item -> item.linkerStatus().name()));
    assertThat(mapping).isEqualTo(existing.board().statuses());

    jdbc.update("update github_repos set deleted_at=now()");
    assertThat(teamRows.findLinkedRepos(id)).isEmpty();
    jdbc.update("update teams set status='DELETED' where id=?", id);
    assertThat(teamRows.findConnection(id)).isEmpty();
    // The existing owner withdrawal guard deliberately includes archived/deleted teams.
    assertThat(teamRows.findOwnedTeams(owner.getId())).hasSize(1);
  }

  @Test
  void jpaMembershipRetainsRoleStatusAndLeftPeriodChecks() throws Exception {
    var owner = user("jpa-access", UserType.DEVELOPER);
    long id = create(cookie(owner));
    for (String status : List.of("ACTIVE", "COMPLETED", "READ_ONLY", "ARCHIVED", "DELETED")) {
      jdbc.update("update teams set status=? where id=?", status, id);
      for (String role : List.of("OWNER", "ADMIN", "MEMBER")) {
        jdbc.update("update team_members set role=? where team_id=?", role, id);
        boolean readable = !List.of("ARCHIVED", "DELETED").contains(status);
        assertThat(access.hasRole(owner.getId(), id, TeamRole.Level.MEMBER)).isEqualTo(readable);
        assertThat(access.hasRole(owner.getId(), id, TeamRole.Level.ADMIN))
            .isEqualTo(readable && !role.equals("MEMBER"));
        assertThat(access.hasRole(owner.getId(), id, TeamRole.Level.OWNER))
            .isEqualTo(readable && role.equals("OWNER"));
      }
    }
    jdbc.update("update teams set status='ACTIVE' where id=?", id);
    jdbc.update("update team_members set left_at=now() where team_id=?", id);
    assertThat(memberRows.findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(id)).isEmpty();
    assertThat(access.hasRole(owner.getId(), id, TeamRole.Level.MEMBER)).isFalse();
    jdbc.update("update team_members set left_at=null where team_id=?", id);
    for (String status : List.of("ACTIVE", "SUSPENDED", "WITHDRAWING", "DELETED")) {
      jdbc.update("update users set status=? where id=?", status, owner.getId());
      assertThat(access.hasRole(owner.getId(), id, TeamRole.Level.MEMBER))
          .isEqualTo(List.of("ACTIVE", "SUSPENDED").contains(status));
    }
    jdbc.update("update users set status='ACTIVE',user_type='RECRUITER' where id=?", owner.getId());
    assertThat(access.hasRole(owner.getId(), id, TeamRole.Level.MEMBER)).isFalse();
    assertThat(access.hasRole(0, id, TeamRole.Level.MEMBER)).isFalse();
  }

  @Test
  void allSevenV20TablesCanBeReadThroughTheirActualJpaMappings() throws Exception {
    var owner = user("jpa-mapping", UserType.DEVELOPER);
    var session = cookie(owner);
    long id = create(session);
    link(session, id);
    board(session, id);
    var team = entityManager.find(com.linker.backend.entity.team.Team.class, id);
    assertThat(team.getCreatedAt()).isNotNull();
    assertThat(team.isAiSummaryEnabled()).isTrue();
    var installation =
        entityManager.find(
            com.linker.backend.entity.github.GithubInstallation.class, team.getInstallationId());
    assertThat(installation.getGithubInstallationId()).isEqualTo(42);
    var member = memberRows.findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(id).getFirst();
    assertThat(member.getUserId()).isEqualTo(owner.getId());
    assertThat(member.getGithubOrgState().name()).isEqualTo("MEMBER");
    var repo =
        entityManager.find(
            com.linker.backend.entity.team.TeamRepo.class,
            jdbc.queryForObject("select id from team_repos", Long.class));
    assertThat(repo.getRepoId()).isEqualTo(teamRows.findLinkedRepos(id).getFirst().repoId());
    var project =
        entityManager.find(
            com.linker.backend.entity.team.TeamProjectBoard.class,
            teamRows.findConnection(id).orElseThrow().boardId());
    assertThat(project.getGithubProjectNodeId()).isEqualTo(issueRepository.context(id).board().nodeId());
    var option =
        entityManager.find(
            com.linker.backend.entity.team.BoardStatusMapping.class,
            jdbc.queryForObject("select min(id) from board_status_mappings", Long.class));
    assertThat(option.getGithubOptionName()).isNotBlank();
    Long pr =
        jdbc.queryForObject(
            """
            insert into pull_requests(team_id,repo_id,github_pr_id,number,title,state,draft,
              github_updated_at,created_at,updated_at) values (?,?,9901,1,'PR','OPEN',false,now(),now(),now()) returning id
            """,
            Long.class,
            id,
            repo.getRepoId());
    assertThat(
            entityManager
                .find(com.linker.backend.entity.github.PullRequest.class, pr)
                .getState()
                .name())
        .isEqualTo("OPEN");
    assertThat(
            jdbc.queryForObject(
                "select success from flyway_schema_history where version='20'", Boolean.class))
        .isTrue();
  }

  @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;

  @Test
  void setupSessionLockSurvivesShortCommitsRejectsContendersAndReleasesAfterFailure()
      throws Exception {
    var entered = new java.util.concurrent.CountDownLatch(1);
    var release = new java.util.concurrent.CountDownLatch(1);
    try (var executor = java.util.concurrent.Executors.newSingleThreadExecutor()) {
      var held =
          executor.submit(
              () ->
                  teamRows.withTeamSetupLock(
                      1234567,
                      () -> {
                        outside();
                        new org.springframework.transaction.support.TransactionTemplate(
                                transactionManager)
                            .executeWithoutResult(
                                status -> jdbc.queryForObject("select 1", Integer.class));
                        outside();
                        entered.countDown();
                        try {
                          if (!release.await(10, java.util.concurrent.TimeUnit.SECONDS))
                            throw new AssertionError("lock test timed out");
                        } catch (InterruptedException failure) {
                          throw new AssertionError(failure);
                        }
                        throw new IllegalStateException("synthetic callback failure");
                      }));
      try {
        assertThat(entered.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
        assertThatThrownBy(() -> teamRows.withTeamSetupLock(1234567, () -> null))
            .isInstanceOfSatisfying(
                ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(409));
        assertThat(teamRows.withOrganizationSetupLock(1234567, () -> "independent scope"))
            .isEqualTo("independent scope");
      } finally {
        release.countDown();
      }
      assertThatThrownBy(() -> held.get(10, java.util.concurrent.TimeUnit.SECONDS))
          .hasRootCauseInstanceOf(IllegalStateException.class)
          .hasRootCauseMessage("synthetic callback failure");
    }
    assertThat(teamRows.withTeamSetupLock(1234567, () -> "released")).isEqualTo("released");
    new org.springframework.transaction.support.TransactionTemplate(transactionManager)
        .executeWithoutResult(
            status ->
                assertThatThrownBy(() -> teamRows.withTeamSetupLock(1234567, () -> null))
                    .isInstanceOf(
                        org.springframework.transaction.IllegalTransactionStateException.class));
  }

  @Test
  void pullRequestUpsertRejectsOlderSnapshotsAndRollsBackWithTheCaller() throws Exception {
    var owner = user("pr-revision", UserType.DEVELOPER);
    var session = cookie(owner);
    long team = create(session);
    link(session, team);
    long repoId = teamRows.repoId(repo.id());
    var tx = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
    var recent =
        new PullRequest(
            9988,
            1,
            "recent",
            "CLOSED",
            false,
            "author",
            "https://github.com/org/api/pull/1",
            null,
            Instant.parse("2026-11-01T12:00:00Z"),
            Instant.parse("2026-11-01T12:00:00Z"));
    var old =
        new PullRequest(
            9988,
            1,
            "old",
            "OPEN",
            false,
            "author",
            "https://github.com/org/api/pull/1",
            null,
            null,
            recent.updatedAt().minusSeconds(60));
    tx.executeWithoutResult(
        status -> {
          teamRows.cachePullRequest(team, repoId, recent, Instant.now());
          teamRows.cachePullRequest(team, repoId, old, Instant.now());
        });
    assertThat(
            jdbc.queryForObject(
                "select title from pull_requests where github_pr_id=9988", String.class))
        .isEqualTo("recent");
    var cancelled =
        new PullRequest(
            9989, 2, "rollback", "OPEN", false, "author", null, null, null, recent.updatedAt());
    tx.executeWithoutResult(
        status -> {
          teamRows.cachePullRequest(team, repoId, cancelled, Instant.now());
          status.setRollbackOnly();
        });
    assertThat(
            jdbc.queryForObject(
                "select count(*) from pull_requests where github_pr_id=9989", Long.class))
        .isZero();
    assertThatThrownBy(() -> teamRows.cachePullRequest(team, repoId, old, Instant.now()))
        .isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
  }

  @Test
  void workspaceJpaProjectionHasBoundedQueryCountAsTeamsGrow() throws Exception {
    var owner = user("query-count", UserType.DEVELOPER);
    seedMembership(owner, 8000, "ACTIVE");
    var statistics =
        entityManager
            .getEntityManagerFactory()
            .unwrap(org.hibernate.SessionFactory.class)
            .getStatistics();
    boolean enabled = statistics.isStatisticsEnabled();
    statistics.setStatisticsEnabled(true);
    try {
      statistics.clear();
      assertThat(teamRows.findCurrentTeams(owner.getId())).hasSize(1);
      long queries = statistics.getPrepareStatementCount();
      for (int i = 1; i < 5; i++) seedMembership(owner, 8000 + i, i == 4 ? "ARCHIVED" : "ACTIVE");
      statistics.clear();
      var rows = teamRows.findCurrentTeams(owner.getId());
      assertThat(rows).hasSize(5);
      assertThat(rows.getLast().status()).isEqualTo("ARCHIVED");
      assertThat(rows).allSatisfy(row -> assertThat(row.openIssueCount()).isNull());
      assertThat(statistics.getPrepareStatementCount()).isEqualTo(queries).isEqualTo(3);
    } finally {
      statistics.setStatisticsEnabled(enabled);
    }
  }

  private void seedMembership(User owner, long org, String status) {
    long installation =
        jdbc.queryForObject(
            "insert into"
                + " github_installations(github_installation_id,account_id,account_login,account_type,repository_selection,installed_by,created_at,updated_at)"
                + " values (?,?,'seed','Organization','ALL',?,now(),now()) returning id",
            Long.class,
            org,
            org,
            owner.getId());
    long team =
        jdbc.queryForObject(
            "insert into"
                + " teams(installation_id,github_org_id,github_org_login,name,status,created_by,created_at,updated_at)"
                + " values (?,?,'seed','Seed',?,?,now(),now()) returning id",
            Long.class,
            installation,
            org,
            status,
            owner.getId());
    jdbc.update(
        "insert into"
            + " team_members(team_id,user_id,role,github_org_state,joined_at,created_at,updated_at)"
            + " values (?,?,'OWNER','MEMBER',now(),now(),now())",
        team,
        owner.getId());
  }

  private User user(String name, UserType type) {
    return users.saveAndFlush(User.create(name, type));
  }

  private void join(long team, User user, String role, String githubState) {
    jdbc.update(
        "insert into"
            + " team_members(team_id,user_id,role,github_org_state,joined_at,created_at,updated_at)"
            + " values (?,?,?,?,now(),now(),now())",
        team,
        user.getId(),
        role,
        githubState);
    jdbc.update(
        "insert into chat_room_members(room_id,user_id,joined_at,created_at,updated_at) select"
            + " id,?,now(),now(),now() from chat_rooms where team_id=?",
        user.getId(),
        team);
  }

  private void signedWebhook(String delivery, String event, String body) throws Exception {
    var mac = javax.crypto.Mac.getInstance("HmacSHA256");
    mac.init(
        new javax.crypto.spec.SecretKeySpec(
            "team-test-secret".getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
    String signature =
        "sha256="
            + java.util.HexFormat.of()
                .formatHex(mac.doFinal(body.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    mvc.perform(
            post("/api/v1/webhook/github")
                .header("X-GitHub-Delivery", delivery)
                .header("X-GitHub-Event", event)
                .header("X-Hub-Signature-256", signature)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().is2xxSuccessful());
  }

  private Cookie cookie(User user) {
    return new Cookie("linker_session", sessions.issue(user, "team-test", "127.0.0.1").rawToken());
  }

  private void identity(User user, long github) {
    jdbc.update(
        "insert into auth_identities(user_id,provider,provider_user_id,created_at,updated_at)"
            + " values (?,'GITHUB',?,now(),now())",
        user.getId(),
        Long.toString(github));
  }

  private long create(Cookie session) throws Exception {
    var result =
        mvc.perform(
                post("/api/v1/user/teams")
                    .cookie(session)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(createBody()))
            .andExpect(status().isCreated())
            .andReturn();
    return json.readTree(result.getResponse().getContentAsString()).path("id").asLong(0);
  }

  private String createBody() {
    return "{\"installationId\":\"42\",\"name\":\"팀 이름\",\"description\":\"소개\"}";
  }

  private void link(Cookie session, long team) throws Exception {
    mvc.perform(
            put("/api/v1/user/teams/{id}/setup/repos", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"repoIds\":[900]}"))
        .andExpect(status().isNoContent());
  }

  private void board(Cookie session, long team) throws Exception {
    mvc.perform(
            post("/api/v1/user/teams/{id}/setup/board", team)
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"NEW\"}"))
        .andExpect(status().isOk());
  }

  private org.springframework.test.web.servlet.ResultActions complete(Cookie session, long team)
      throws Exception {
    return mvc.perform(post("/api/v1/user/teams/{id}/setup/complete", team).cookie(session));
  }

  private static void outside() {
    assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
  }
}
