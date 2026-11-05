package com.linker.backend.repository.issue;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.linker.backend.dto.issue.request.IssueListQuery;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.global.security.TeamAccess;
import com.linker.backend.integration.github.*;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.service.PublicAuthService;
import com.linker.backend.service.user.*;
import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.http.Cookie;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.*;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    properties = {
      "linker.webhook.consumer-enabled=false",
      "linker.issues.sync-enabled=false",
      "linker.issues.webhook-enabled=true",
      "spring.jpa.show-sql=false"
    })
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Import(IssueReadIntegrationTest.Contracts.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IssueReadIntegrationTest {
  static final RsaMaterial KEYS = RsaMaterial.generate();
  static final String SCHEMA = "issue_page_" + UUID.randomUUID().toString().replace("-", "");
  static PostgreSQLContainer postgres;
  static GenericContainer<?> redisContainer;
  static String dbUrl, dbUser, dbPassword;
  static int redisPort;
  static HttpServer server;
  static final JsonMapper JSON = JsonMapper.builder().build();
  static final List<String> REQUESTS = new CopyOnWriteArrayList<>();
  static final AtomicInteger MUTATIONS = new AtomicInteger();
  static volatile boolean failRest,
      failMutation,
      writable = true,
      projectAdded,
      archived,
      graphqlError;
  static volatile boolean bulk, fieldPages, itemPages, omitSecond, listingMissOnly, failAfterAdd;
  static volatile String issueTitle = "로그인 오류", updated = "2026-11-05T01:00:00Z";
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired NamedParameterJdbcTemplate named;
  @Autowired UserRepository users;
  @Autowired PublicAuthService sessions;
  @Autowired UserIssueSyncService sync;
  @Autowired UserIssueService reads;
  @Autowired UserIssueProgressService progress;
  @Autowired IssueContextRepository contexts;
  @Autowired IssueCacheRepository cache;
  @Autowired IssueReadRepository repository;
  @Autowired IssueSyncLock locks;
  @Autowired StringRedisTemplate redis;
  @Autowired PlatformTransactionManager manager;
  @Autowired IssueSource source;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) throws Exception {
    dbUrl = System.getenv("ISSUE_TEST_DB_URL");
    if (dbUrl == null) {
      postgres = new PostgreSQLContainer("postgres:16-alpine");
      postgres.start();
      dbUrl = postgres.getJdbcUrl();
      dbUser = postgres.getUsername();
      dbPassword = postgres.getPassword();
      redisContainer = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
      redisContainer.start();
      redisPort = redisContainer.getMappedPort(6379);
    } else {
      dbUser = System.getenv().getOrDefault("ISSUE_TEST_DB_USERNAME", "jangabc3");
      dbPassword = System.getenv().getOrDefault("ISSUE_TEST_DB_PASSWORD", "");
      redisPort = Integer.parseInt(System.getenv().getOrDefault("ISSUE_TEST_REDIS_PORT", "15440"));
    }
    new JdbcTemplate(new DriverManagerDataSource(dbUrl, dbUser, dbPassword))
        .execute("CREATE SCHEMA " + SCHEMA);
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/",
        exchange -> {
          String path = exchange.getRequestURI().toString();
          REQUESTS.add(exchange.getRequestMethod() + " " + path);
          int status = 200;
          Object response;
          if (path.contains("access_tokens"))
            response = Map.of("token", "installation-read", "expires_at", "2099-01-01T00:00:00Z");
          else if (path.startsWith("/repos/acme/web/issues")) {
            if (failRest) {
              status = 503;
              response = Map.of("message", "temporary");
            } else if (path.contains("/issues/1")) response = issue(1);
            else if (path.contains("/issues/2")) {
              if (omitSecond) {
                status = 404;
                response = Map.of("message", "not found");
              } else response = issue(2);
            } else if (bulk) {
              if (path.contains("page=2")) response = List.of(issue(101));
              else {
                var page = new ArrayList<Object>();
                for (int i = 1; i <= 100; i++) {
                  var row = issue(i);
                  if (i == 50) row.put("pull_request", Map.of("url", "not-an-issue"));
                  page.add(row);
                }
                response = page;
              }
            } else
              response =
                  omitSecond || listingMissOnly ? List.of(issue(1)) : List.of(issue(1), issue(2));
          } else if (path.equals("/repos/acme/web"))
            response = Map.of("id", 1000, "permissions", Map.of("push", writable));
          else if (path.equals("/graphql")) {
            String body =
                new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            if (body.contains("addProjectV2ItemById")) {
              MUTATIONS.incrementAndGet();
              if (failMutation) {
                response = Map.of("errors", List.of(Map.of("message", "denied")));
              } else {
                projectAdded = true;
                if (failAfterAdd) failRest = true;
                response =
                    Map.of(
                        "data",
                        Map.of("addProjectV2ItemById", Map.of("item", Map.of("id", "ITEM2"))));
              }
            } else if (body.contains("... on ProjectV2Item{fieldValues")) {
              response =
                  Map.of(
                      "data",
                      Map.of(
                          "node",
                          Map.of(
                              "fieldValues",
                              Map.of(
                                  "pageInfo",
                                  Map.of("hasNextPage", false),
                                  "nodes",
                                  List.of(
                                      Map.of(
                                          "field",
                                          Map.of("id", "TARGET"),
                                          "date",
                                          "2026-11-05"))))));
            } else if (graphqlError)
              response = Map.of("errors", List.of(Map.of("message", "denied")));
            else {
              var items = new ArrayList<Object>();
              boolean second =
                  JSON.readTree(body)
                      .path("variables")
                      .path("after")
                      .asString("")
                      .equals("ITEM_PAGE");
              if (second) items.add(project(2));
              else {
                items.add(project(1));
                if (projectAdded && !itemPages) items.add(project(2));
              }
              Map<String, Object> pageInfo =
                  itemPages && !second
                      ? Map.of("hasNextPage", true, "endCursor", "ITEM_PAGE")
                      : Map.of("hasNextPage", false);
              response =
                  Map.of(
                      "data",
                      Map.of(
                          "node",
                          Map.of(
                              "id",
                              "BOARD",
                              "owner",
                              Map.of("login", "acme"),
                              "items",
                              Map.of("nodes", items, "pageInfo", pageInfo))));
            }
          } else {
            status = 404;
            response = Map.of("message", "missing");
          }
          byte[] bytes = JSON.writeValueAsBytes(response);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(status, bytes.length);
          exchange.getResponseBody().write(bytes);
          exchange.close();
        });
    server.start();
    registry.add(
        "spring.datasource.url",
        () -> dbUrl + (dbUrl.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
    registry.add("spring.datasource.username", () -> dbUser);
    registry.add("spring.datasource.password", () -> dbPassword);
    registry.add(
        "spring.data.redis.host",
        () -> redisContainer == null ? "127.0.0.1" : redisContainer.getHost());
    registry.add("spring.data.redis.port", () -> redisPort);
    registry.add("linker.session.jwt-private-key", KEYS::privatePem);
    registry.add("linker.session.jwt-public-key", KEYS::publicPem);
    registry.add("linker.github.webhook-secret", () -> "issue-test-secret");
    registry.add("linker.github.app.id", () -> "123");
    registry.add("linker.github.app.slug", () -> "test-app");
    registry.add("linker.github.app.private-key", KEYS::privatePem);
    registry.add(
        "linker.github.app.api-base-url",
        () -> "http://127.0.0.1:" + server.getAddress().getPort());
  }

  static Map<String, Object> issue(int n) {
    var map = new LinkedHashMap<String, Object>();
    map.put("id", 100L + n);
    map.put("node_id", "ISSUE" + n);
    map.put("number", n);
    map.put("title", n == 1 ? issueTitle : "프로젝트 미등록");
    map.put("state", n == 1 ? "open" : "closed");
    map.put("user", Map.of("login", "kim"));
    map.put("updated_at", updated);
    map.put("closed_at", n == 1 ? null : "2026-11-05T01:00:00Z");
    map.put("html_url", "https://github.com/acme/web/issues/" + n);
    map.put(
        "assignees",
        List.of(
            Map.of("id", 101, "login", "kim"),
            Map.of("id", 102, "login", "former"),
            Map.of("id", 103, "login", "external")));
    map.put("labels", List.of(Map.of("name", n == 1 ? "bug" : "feature", "color", "d73a4a")));
    return map;
  }

  static Map<String, Object> project(int n) {
    return Map.of(
        "id",
        "ITEM" + n,
        "isArchived",
        archived,
        "content",
        Map.of(
            "__typename",
            "Issue",
            "id",
            "ISSUE" + n,
            "repository",
            Map.of("nameWithOwner", "acme/web")),
        "fieldValues",
        Map.of(
            "pageInfo",
            fieldPages
                ? Map.of("hasNextPage", true, "endCursor", "FIELD_PAGE")
                : Map.of("hasNextPage", false),
            "nodes",
            List.of(
                Map.of("field", Map.of("id", "STATUS"), "optionId", "READY"),
                Map.of("field", Map.of("id", "START"), "date", "2026-11-01"),
                Map.of(
                    "field",
                    Map.of("id", fieldPages ? "UNRELATED" : "TARGET"),
                    "date",
                    "2026-11-05"))));
  }

  @TestConfiguration
  static class Contracts {
    // TEST ONLY substitute for B's not-yet-merged membership persistence. No production bypass.
    @Bean
    @Primary
    TeamAccess issueMembership(JdbcTemplate sql) {
      return (user, team, role) ->
          Boolean.TRUE.equals(
              sql.queryForObject(
                  "SELECT EXISTS(SELECT 1 FROM team_members WHERE team_id=? AND user_id=? AND"
                      + " left_at IS NULL)",
                  Boolean.class,
                  team,
                  user));
    }

    @Bean
    @Primary
    GithubUserAccessTokenSource issueUserTokens() {
      return id -> "user-token-" + id;
    }

    @Bean
    @Primary
    Clock issueClock() {
      return Clock.fixed(Instant.parse("2026-11-05T15:30:00Z"), ZoneOffset.UTC);
    }
  }

  @BeforeAll
  void schema() throws Exception {
    try (var connection = jdbc.getDataSource().getConnection()) {
      ScriptUtils.executeSqlScript(
          connection, new ClassPathResource("issue/issue-read-fixture.sql"));
      ScriptUtils.executeSqlScript(
          connection, new ClassPathResource("db/issue-schema/issue-cache.sql"));
    }
  }

  @BeforeEach
  void seed() {
    jdbc.execute(
        "TRUNCATE"
            + " issues,team_progress_snapshots,team_repos,team_members,board_status_mappings,team_project_boards,github_repos,teams,github_installations,subscriptions,users"
            + " RESTART IDENTITY CASCADE");
    jdbc.update(
        "INSERT INTO users(id,username,display_name,user_type,status,created_at,updated_at)"
            + " VALUES(1,'kim','김개발','DEVELOPER','ACTIVE',now(),now()),(2,'former','이전"
            + " 팀원','DEVELOPER','ACTIVE',now(),now()),(3,'stranger','다른"
            + " 사람','DEVELOPER','ACTIVE',now(),now()),(4,'hr','채용"
            + " 담당','RECRUITER','ACTIVE',now(),now())");
    jdbc.update(
        "INSERT INTO auth_identities(user_id,provider,provider_user_id,created_at,updated_at)"
            + " VALUES(1,'GITHUB','101',now(),now()),(2,'GITHUB','102',now(),now())");
    jdbc.update("INSERT INTO github_installations VALUES(1,500,NULL,NULL)");
    jdbc.update("INSERT INTO teams VALUES(10,1,700,'acme','ACTIVE'),(20,1,700,'acme','READ_ONLY')");
    jdbc.update(
        "INSERT INTO github_repos"
            + " VALUES(100,1000,'acme','web',NULL),(200,2000,'other','private',NULL)");
    jdbc.update("INSERT INTO team_repos VALUES(1,10,100),(2,20,200)");
    jdbc.update(
        "INSERT INTO team_members"
            + " VALUES(1,10,1,'MEMBER',NULL),(2,10,2,'MEMBER',now()),(3,20,1,'MEMBER',NULL)");
    jdbc.update(
        "INSERT INTO team_project_boards"
            + " VALUES(1,10,'BOARD','STATUS','START','TARGET'),(2,20,'OTHERBOARD','STATUS','START','TARGET')");
    jdbc.update("INSERT INTO board_status_mappings VALUES(1,1,'READY','TODO')");
    for (String key : redis.keys("issues:*")) redis.delete(key);
    bulk = false;
    fieldPages = false;
    itemPages = false;
    omitSecond = false;
    listingMissOnly = false;
    failAfterAdd = false;
    failRest = false;
    failMutation = false;
    writable = true;
    projectAdded = false;
    archived = false;
    graphqlError = false;
    issueTitle = "로그인 오류";
    updated = "2026-11-05T01:00:00Z";
    MUTATIONS.set(0);
    REQUESTS.clear();
  }

  Cookie login(long id) {
    var user = users.findById(id).orElseThrow();
    return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
  }

  AuthenticatedUser member() {
    return new AuthenticatedUser(
        1, "kim", UserType.DEVELOPER, UserStatus.ACTIVE, null, false, false, false, 1);
  }

  IssueListQuery query(String label, String cursor, int size) {
    return new IssueListQuery(null, null, null, label, false, cursor, size);
  }

  @Test
  void fullSyncReadsDatesByIdAndCachesOnlyLinkedData() {
    assertThat(sync.initialSync(10)).isEqualTo(2);
    var page = reads.list(member(), 10, query(null, null, 20), false);
    assertThat(page.total()).isEqualTo(2);
    assertThat(page.canWrite()).isTrue();
    var row = page.items().stream().filter(i -> i.number() == 1).findFirst().orElseThrow();
    assertThat(row.dueDate()).isEqualTo(LocalDate.of(2026, 11, 5));
    assertThat(row.overdue()).isTrue();
    assertThat(row.syncStatus()).isEqualTo("SYNCED");
    assertThat(row.assignees()).anyMatch(a -> a.id() == null && !a.inTeam());
    assertThat(row.assignees()).anyMatch(a -> a.login().equals("former") && !a.inTeam());
  }

  @Test
  void cursorIsStableAndScopedToFiltersAndTeam() {
    sync.fullSync(10);
    var first = repository.list(10, query(null, null, 1), false, LocalDate.of(2026, 11, 6));
    var second =
        repository.list(10, query(null, first.nextCursor(), 1), false, LocalDate.of(2026, 11, 6));
    assertThat(second.items().getFirst().id()).isNotEqualTo(first.items().getFirst().id());
    assertThat(second.total()).isEqualTo(2);
    assertThat(second.nextCursor()).isNull();
    assertThatThrownBy(
            () -> repository.list(20, query(null, first.nextCursor(), 1), false, LocalDate.now()))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(
            () -> repository.list(10, query("null", first.nextCursor(), 1), false, LocalDate.now()))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void threeReadEndpointsAndFilterOptionsUseRealSecurity() throws Exception {
    sync.fullSync(10);
    var cookie = login(1);
    mvc.perform(
            get("/api/v1/user/teams/10/issues")
                .cookie(cookie)
                .param("label", "bug")
                .param("assignee", "kim"))
        .andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(jsonPath("$.total").value(1));
    mvc.perform(get("/api/v1/user/teams/10/issues/unscheduled").cookie(cookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1));
    mvc.perform(get("/api/v1/user/teams/10/issue-filters").cookie(cookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.members.length()").value(1));
    mvc.perform(get("/api/v1/user/teams/10/issues")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/user/teams/10/issues").cookie(login(3)))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/user/teams/10/issues").cookie(login(4)))
        .andExpect(status().isForbidden());
  }

  @Test
  void invalidInputsAndSqlInjectionDoNotExpandScope() throws Exception {
    sync.fullSync(10);
    var cookie = login(1);
    for (String key : List.of("repo", "size", "open"))
      mvc.perform(get("/api/v1/user/teams/10/issues").cookie(cookie).param(key, "bad"))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    mvc.perform(get("/api/v1/user/teams/10/issues").cookie(cookie).param("cursor", "bad"))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/user/teams/10/issues").cookie(cookie).param("label", "' OR 1=1 --"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
  }

  @Test
  void manualRefreshOnlyTouchesMatchingIssuesAndRateIsEnforced() throws Exception {
    sync.fullSync(10);
    REQUESTS.clear();
    var cookie = login(1);
    mvc.perform(post("/api/v1/user/teams/10/issues/refresh").cookie(cookie).param("label", "bug"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.updatedCount").value(1));
    assertThat(REQUESTS)
        .contains("GET /repos/acme/web/issues/1")
        .doesNotContain("GET /repos/acme/web/issues/2");
    mvc.perform(post("/api/v1/user/teams/10/issues/refresh").cookie(cookie))
        .andExpect(status().isTooManyRequests());
  }

  @Test
  void addToProjectChecksRepoWriteAndIsIdempotent() throws Exception {
    sync.fullSync(10);
    long id = jdbc.queryForObject("SELECT id FROM issues WHERE number=2", Long.class);
    var cookie = login(1);
    writable = false;
    mvc.perform(post("/api/v1/user/teams/10/issues/" + id + "/project-item").cookie(cookie))
        .andExpect(status().isForbidden());
    assertThat(MUTATIONS).hasValue(0);
    writable = true;
    mvc.perform(post("/api/v1/user/teams/10/issues/" + id + "/project-item").cookie(cookie))
        .andExpect(status().isNoContent());
    mvc.perform(post("/api/v1/user/teams/10/issues/" + id + "/project-item").cookie(cookie))
        .andExpect(status().isNoContent());
    assertThat(MUTATIONS).hasValue(1);
    assertThat(
            jdbc.queryForObject("SELECT project_item_id FROM issues WHERE id=?", String.class, id))
        .isEqualTo("ITEM2");
  }

  @Test
  void readOnlyTeamsRejectRefreshWithoutCallingGithub() throws Exception {
    REQUESTS.clear();
    mvc.perform(post("/api/v1/user/teams/20/issues/refresh").cookie(login(1)))
        .andExpect(status().isForbidden());
    assertThat(REQUESTS).isEmpty();
  }

  @Test
  void failedSourceDoesNotDeleteOrPartiallyReplaceCache() {
    sync.fullSync(10);
    failRest = true;
    assertThatThrownBy(() -> sync.fullSync(10)).isInstanceOf(ApiException.class);
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM issues WHERE deleted_at IS NULL", Integer.class))
        .isEqualTo(2);
    failRest = false;
    graphqlError = true;
    assertThatThrownBy(() -> sync.fullSync(10)).isInstanceOf(ApiException.class);
  }

  @Test
  void failedMutationNeverPretendsProjectWasAdded() {
    sync.fullSync(10);
    long id = jdbc.queryForObject("SELECT id FROM issues WHERE number=2", Long.class);
    failMutation = true;
    assertThatThrownBy(() -> sync.addToProject(member(), 10, id)).isInstanceOf(ApiException.class);
    assertThat(
            jdbc.queryForObject("SELECT project_item_id FROM issues WHERE id=?", String.class, id))
        .isNull();
  }

  @Test
  void olderIssueTimestampCannotOverwriteTitle() {
    sync.fullSync(10);
    issueTitle = "오래된 제목";
    updated = "2026-11-04T01:00:00Z";
    sync.fullSync(10);
    assertThat(jdbc.queryForObject("SELECT title FROM issues WHERE number=1", String.class))
        .isEqualTo("로그인 오류");
  }

  @Test
  void sameTeamLockCoversEveryEntryAndRejectsOuterTransaction() {
    locks.team(
        10,
        () -> {
          assertThatThrownBy(() -> sync.fullSync(10)).isInstanceOf(ApiException.class);
          return null;
        });
    assertThatThrownBy(() -> new TransactionTemplate(manager).execute(status -> sync.fullSync(10)))
        .isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
  }

  @Test
  void duplicateWebhookRequeriesAndMissingBindingsAreNotAcknowledged() {
    var handler = new GithubIssueWebhookHandler(sync, contexts, named);
    var delivery =
        GithubWebhookDelivery.received(
            "delivery",
            "issues",
            "edited",
            500L,
            JSON.writeValueAsString(
                Map.of(
                    "action",
                    "edited",
                    "installation",
                    Map.of("id", 500),
                    "organization",
                    Map.of("id", 700),
                    "repository",
                    Map.of("id", 1000),
                    "issue",
                    Map.of("id", 101))));
    handler.handle(delivery);
    handler.handle(delivery);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isEqualTo(2);
    assertThatThrownBy(() ->
            handler.handle(
                GithubWebhookDelivery.received(
                    "bad", "issues", "edited", 999L, delivery.getPayload().replace("500", "999"))))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void archivedProjectDoesNotBecomeClosedOrDeleted() {
    sync.fullSync(10);
    archived = true;
    assertThatThrownBy(() -> sync.fullSync(10)).isInstanceOf(ApiException.class);
    assertThat(jdbc.queryForObject("SELECT state FROM issues WHERE number=1", String.class))
        .isEqualTo("OPEN");
    assertThat(jdbc.queryForObject("SELECT due_date FROM issues WHERE number=1", LocalDate.class))
        .isEqualTo(LocalDate.of(2026, 11, 5));
  }

  @Test
  void scheduleRetriesWhenDueAndSkipsFreshFullScan() {
    sync.syncDueTeams();
    int calls = REQUESTS.size();
    sync.syncDueTeams();
    assertThat(REQUESTS).hasSize(calls);
    redis.opsForValue().set("issues:last-full-sync:10", "2026-11-05T15:00:00Z");
    sync.syncDueTeams();
    assertThat(REQUESTS.size()).isGreaterThan(calls);
  }

  @Test
  void snapshotsCoverFreeTeamsAreIdempotentAndRetentionIsOneYear() {
    sync.fullSync(10);
    jdbc.update(
        "INSERT INTO"
            + " team_progress_snapshots(team_id,snapshot_date,todo_count,in_progress_count,blocked_count,done_count,overdue_count)"
            + " VALUES(10,'2024-01-01',0,0,0,0,0)");
    progress.snapshot();
    progress.snapshot();
    assertThat(jdbc.queryForObject("SELECT count(*) FROM team_progress_snapshots", Integer.class))
        .isEqualTo(2);
    assertThat(
            jdbc.queryForObject(
                "SELECT snapshot_date FROM team_progress_snapshots WHERE team_id=10",
                LocalDate.class))
        .isEqualTo(LocalDate.of(2026, 11, 5));
  }

  @Test
  void flexProgressIncludesTodayAndLeavesUncollectedHistoryMissing() throws Exception {
    sync.fullSync(10);
    var cookie = login(1);
    mvc.perform(get("/api/v1/user/teams/10/progress").cookie(cookie))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("PLAN_LIMIT"));
    jdbc.update("INSERT INTO subscriptions VALUES(1,10,'FLEX','ACTIVE','2099-01-01',NULL)");
    mvc.perform(get("/api/v1/user/teams/10/progress").cookie(cookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.completion.total").value(2))
        .andExpect(jsonPath("$.history.length()").value(14));
    assertThat(progress.progress(member(), 10, 14).history().getFirst().todo()).isNull();
    jdbc.update("UPDATE subscriptions SET current_period_end='2020-01-01'");
    mvc.perform(get("/api/v1/user/teams/10/progress").cookie(cookie))
        .andExpect(status().isForbidden());
  }

  @Test
  void openApiContainsSixPageEndpointsAndKeepsFoundationTags() throws Exception {
    var result =
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams/{teamId}/issues'].get.tags[0]")
                    .value("p11-issue-list"))
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams/{teamId}/issues/refresh'].post.operationId")
                    .value("refreshTeamIssues"))
            .andExpect(
                jsonPath(
                        "$.paths['/api/v1/user/teams/{teamId}/issues/{issueId}/project-item'].post.responses['204']")
                    .exists())
            .andExpect(jsonPath("$.paths['/api/v1/user/me'].get.tags[0]").value("p00-common"))
            .andReturn();
    Path path = Path.of("build/openapi/page11.json");
    Files.createDirectories(path.getParent());
    Files.writeString(path, result.getResponse().getContentAsString(StandardCharsets.UTF_8));
  }

  @Test
  void sourcePaginationExcludesPullRequestsAndReadsAllProjectFieldPages() {
    var context = contexts.get(10);
    bulk = true;
    assertThat(source.list(context.repos().getFirst(), "installation-read"))
        .hasSize(100)
        .noneMatch(i -> i.number() == 50);
    bulk = false;
    fieldPages = true;
    itemPages = true;
    var project = source.project(context, "installation-read");
    assertThat(project).hasSize(2);
    assertThat(project.get("ISSUE1").due()).isEqualTo(LocalDate.of(2026, 11, 5));
  }

  @Test
  void adapterRejectsNetworkInsideTransaction() {
    var repo = contexts.get(10).repos().getFirst();
    REQUESTS.clear();
    assertThatThrownBy(() ->
            new TransactionTemplate(manager).execute(tx -> source.list(repo, "installation-read")))
        .isInstanceOf(IllegalStateException.class);
    assertThat(REQUESTS).isEmpty();
  }

  @Test
  void completeResyncReconcilesMissingIssuesWithoutHardDelete() {
    sync.fullSync(10);
    omitSecond = true;
    sync.fullSync(10);
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM issues WHERE deleted_at IS NULL", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isEqualTo(2);
  }

  @Test
  void suspendedMemberCanReadButCannotWrite() throws Exception {
    sync.fullSync(10);
    jdbc.update("UPDATE users SET status='SUSPENDED' WHERE id=1");
    var cookie = login(1);
    mvc.perform(get("/api/v1/user/teams/10/issues").cookie(cookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.canWrite").value(false));
    mvc.perform(post("/api/v1/user/teams/10/issues/refresh").cookie(cookie))
        .andExpect(status().isForbidden());
  }

  @Test
  void pendingPaymentWithinGraceStillHasFlexButExpiredGraceDoesNot() {
    sync.fullSync(10);
    jdbc.update(
        "INSERT INTO subscriptions VALUES(1,10,'FLEX','PAST_DUE','2020-01-01','2099-01-01')");
    assertThat(progress.progress(member(), 10, 14).completion().total()).isEqualTo(2);
    jdbc.update("UPDATE subscriptions SET grace_until='2020-01-01'");
    assertThatThrownBy(() -> progress.progress(member(), 10, 14))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.getCode()).isEqualTo("PLAN_LIMIT"));
  }

  @Test
  void changedTeamBindingPreventsStaleCacheCommit() {
    var old = contexts.get(10);
    jdbc.update("UPDATE team_project_boards SET due_date_field_id='CHANGED' WHERE team_id=10");
    assertThatThrownBy(() ->
            cache.apply(
                old,
                new IssueSource.Snapshot(
                    List.of(new IssueSource.RepositoryIssues(old.repos().getFirst(), List.of())),
                    Map.of()),
                true,
                Instant.now()))
        .isInstanceOf(ApiException.class);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isZero();
  }

  @Test
  void temporaryPaginationMissDoesNotDeleteExistingIssue() {
    sync.fullSync(10);
    listingMissOnly = true;
    sync.fullSync(10);
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM issues WHERE deleted_at IS NULL", Integer.class))
        .isEqualTo(2);
  }

  @Autowired GithubWebhookService webhookIngress;

  @Test
  void signedWebhookPassesBRowIdQueueAndRealDispatchIntoCCache() throws Exception {
    String payload =
        JSON.writeValueAsString(
            Map.of(
                "action",
                "edited",
                "installation",
                Map.of("id", 500),
                "organization",
                Map.of("id", 700),
                "repository",
                Map.of("id", 1000),
                "issue",
                Map.of("id", 101)));
    var mac = javax.crypto.Mac.getInstance("HmacSHA256");
    mac.init(
        new javax.crypto.spec.SecretKeySpec(
            "issue-test-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String signature =
        "sha256=" + HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    mvc.perform(
            post("/api/v1/webhook/github")
                .header("X-GitHub-Delivery", "c-page11-signed")
                .header("X-GitHub-Event", "issues")
                .header("X-Hub-Signature-256", signature)
                .contentType("application/json")
                .content(payload))
        .andExpect(status().isAccepted());
    long row =
        jdbc.queryForObject(
            "SELECT id FROM github_webhook_deliveries WHERE delivery_id='c-page11-signed'",
            Long.class);
    assertThat(redis.opsForList().range("linker:github:webhook", 0, -1))
        .contains(Long.toString(row));
    webhookIngress.dispatch(row);
    assertThat(
            jdbc.queryForObject(
                "SELECT status FROM github_webhook_deliveries WHERE id=?", String.class, row))
        .isEqualTo("PROCESSED");
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM issues WHERE deleted_at IS NULL", Integer.class))
        .isEqualTo(2);
  }

  @Test
  void confirmedMutationWithFailedReadbackIsMarkedFailedAndFullSyncRecovers() {
    sync.fullSync(10);
    long id = jdbc.queryForObject("SELECT id FROM issues WHERE number=2", Long.class);
    failAfterAdd = true;
    assertThatThrownBy(() -> sync.addToProject(member(), 10, id)).isInstanceOf(ApiException.class);
    assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id=?", String.class, id))
        .isEqualTo("FAILED");
    assertThat(
            jdbc.queryForObject("SELECT project_item_id FROM issues WHERE id=?", String.class, id))
        .isEqualTo("ITEM2");
    failAfterAdd = false;
    failRest = false;
    sync.fullSync(10);
    assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id=?", String.class, id))
        .isEqualTo("SYNCED");
  }

  @Test
  void disconnectedAndDeletedReposAreExcludedFromAllProgressMetrics() {
    sync.fullSync(10);
    jdbc.update(
        "INSERT INTO"
            + " issues(team_id,repo_id,github_issue_id,github_node_id,number,title,state,board_status,due_date,github_updated_at)"
            + " VALUES(10,200,900,'ISSUE900',900,'disconnected','OPEN','TODO','2026-11-01',now())");
    jdbc.update(
        "INSERT INTO issue_assignees(issue_id,github_user_id,github_login,user_id) SELECT"
            + " id,101,'kim',1 FROM issues WHERE github_issue_id=900");
    jdbc.update("INSERT INTO subscriptions VALUES(1,10,'FLEX','ACTIVE','2099-01-01',NULL)");
    var first = progress.progress(member(), 10, 14);
    assertThat(first.completion().total()).isEqualTo(2);
    assertThat(first.openByAssignee().getFirst().openCount()).isEqualTo(1);
    jdbc.update("UPDATE github_repos SET deleted_at=now() WHERE id=100");
    var empty = progress.progress(member(), 10, 14);
    assertThat(empty.completion().total()).isZero();
    assertThat(empty.overdueCount()).isZero();
    progress.snapshot();
    assertThat(
            jdbc.queryForObject(
                "SELECT todo_count+in_progress_count+blocked_count+done_count FROM"
                    + " team_progress_snapshots WHERE team_id=10",
                Integer.class))
        .isZero();
  }

  @AfterAll
  void cleanup() {
    if (server != null) server.stop(0);
    if (jdbc != null) jdbc.execute("DROP SCHEMA " + SCHEMA + " CASCADE");
    if (redisContainer != null) redisContainer.stop();
    if (postgres != null) postgres.stop();
  }
}
