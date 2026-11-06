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
  static volatile List<Map<String, Object>> editedAssignees, editedLabels;
  static volatile String editedState, boardOption, startValue, dueValue;
  static volatile boolean ignoreEdit, failDueOnce, redirectDetail, missingDetail, failAfterEditOnce;
  static volatile String redirectLocation;
  static volatile boolean moveConnected, movedIdentityWrong, emptyChildren, selfChild, rateLimited;
  static final java.util.concurrent.atomic.AtomicReference<String> LAST_AUTHORIZATION =
      new java.util.concurrent.atomic.AtomicReference<>();
  @Autowired GithubTokenCipher tokenCipher;
  @Autowired PersistedGithubUserAccessTokenSource persistedTokens;
  @Autowired com.linker.backend.global.config.GithubAppProperties githubProperties;
  @Autowired UserIssueDetailService details;
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
          LAST_AUTHORIZATION.set(exchange.getRequestHeaders().getFirst("Authorization"));
          REQUESTS.add(exchange.getRequestMethod() + " " + path);
          int status = 200;
          Object response;
          if (path.contains("access_tokens"))
            response = Map.of("token", "installation-read", "expires_at", "2099-01-01T00:00:00Z");
          else if (rateLimited && path.equals("/repos/acme/web/issues/1")) {
            status = 429;
            exchange.getResponseHeaders().add("Retry-After", "120");
            response = Map.of("message", "rate limited");
          } else if (path.equals("/repos/acme/mobile"))
            response = Map.of("id", 3000, "permissions", Map.of("push", true));
          else if (path.equals("/repos/acme/mobile/issues/7")) {
            var moved = issue(movedIdentityWrong ? 99 : 1);
            moved.put("number", 7);
            moved.put("html_url", "https://github.com/acme/mobile/issues/7");
            response = moved;
          } else if (path.startsWith("/repos/acme/web/collaborators/")) {
            String login = path.split("/")[5];
            response = Map.of("user", Map.of("login", login), "permission", "read");
          } else if (path.startsWith("/repos/acme/web/labels")) {
            response =
                List.of(
                    Map.of("name", "bug", "color", "d73a4a"),
                    Map.of("name", "feature", "color", "00ff00"));
          } else if (path.contains("/sub_issues")) {
            var hidden = issue(3);
            hidden.put("html_url", "https://github.com/other/private/issues/3");
            response =
                selfChild
                    ? List.of(issue(1))
                    : emptyChildren ? List.of() : List.of(issue(2), hidden);
          } else if (path.equals("/repos/acme/web/issues/1")
              && exchange.getRequestMethod().equals("PATCH")) {
            var input = JSON.readTree(exchange.getRequestBody());
            if (!ignoreEdit) {
              if (input.has("assignees")) {
                var a = new ArrayList<Map<String, Object>>();
                for (var login : input.path("assignees"))
                  a.add(
                      Map.of(
                          "id",
                          login.asString().equals("kim") ? 101 : 102,
                          "login",
                          login.asString()));
                editedAssignees = a;
              }
              if (input.has("labels")) {
                var labels = new ArrayList<Map<String, Object>>();
                for (var label : input.path("labels"))
                  labels.add(
                      Map.of(
                          "name",
                          label.asString(),
                          "color",
                          label.asString().equals("bug") ? "d73a4a" : "00ff00"));
                editedLabels = labels;
              }
              if (input.has("state")) editedState = input.path("state").asString();
            }
            response = issue(1);
            if (failAfterEditOnce) {
              failAfterEditOnce = false;
              failRest = true;
            }
          } else if (path.equals("/repos/acme/web/issues/1") && (redirectDetail || missingDetail)) {
            status = redirectDetail ? 301 : 404;
            exchange
                .getResponseHeaders()
                .add(
                    "Location",
                    redirectLocation == null
                        ? "https://api.github.com/repositories/999/issues/3"
                        : redirectLocation);
            response = Map.of("message", "moved");
          } else if (path.startsWith("/repos/acme/web/issues")) {
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
            if (body.contains("updateProjectV2ItemFieldValue")
                || body.contains("clearProjectV2ItemFieldValue")) {
              var variables = JSON.readTree(body).path("variables");
              String field = variables.path("field").asString();
              if (failDueOnce && field.equals("TARGET")) {
                failDueOnce = false;
                response = Map.of("errors", List.of(Map.of("message", "temporary")));
              } else {
                if (field.equals("STATUS"))
                  boardOption = variables.path("value").path("singleSelectOptionId").asString();
                if (field.equals("START"))
                  startValue = variables.path("value").path("date").asString(null);
                if (field.equals("TARGET"))
                  dueValue = variables.path("value").path("date").asString(null);
                String op =
                    body.contains("clearProjectV2ItemFieldValue")
                        ? "clearProjectV2ItemFieldValue"
                        : "updateProjectV2ItemFieldValue";
                response =
                    Map.of("data", Map.of(op, Map.of("projectV2Item", Map.of("id", "ITEM1"))));
              }
            } else if (body.contains("addProjectV2ItemById")) {
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
    registry.add(
        "linker.github.app.token-encryption-key",
        () -> Base64.getEncoder().encodeToString(new byte[32]));
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
    map.put("state", n == 1 && editedState != null ? editedState : n == 1 ? "open" : "closed");
    map.put("body", "## 로그인 오류\n<script>alert(1)</script>\n[위험](javascript:alert(1))");
    map.put("user", Map.of("id", 101, "login", "kim"));
    map.put("created_at", "2026-10-01T01:00:00Z");
    map.put("updated_at", updated);
    map.put("closed_at", n == 1 && !"closed".equals(editedState) ? null : "2026-11-05T01:00:00Z");
    map.put("html_url", "https://github.com/acme/web/issues/" + n);
    map.put(
        "assignees",
        List.of(
            Map.of("id", 101, "login", "kim"),
            Map.of("id", 102, "login", "former"),
            Map.of("id", 103, "login", "external")));
    map.put("labels", List.of(Map.of("name", n == 1 ? "bug" : "feature", "color", "d73a4a")));
    if (n == 1 && editedAssignees != null) map.put("assignees", editedAssignees);
    if (n == 1 && editedLabels != null) map.put("labels", editedLabels);
    return map;
  }

  static Map<String, Object> project(int n) {
    var fields = new ArrayList<Object>();
    fields.add(
        Map.of(
            "field",
            Map.of("id", "STATUS"),
            "optionId",
            boardOption == null ? "READY" : boardOption));
    if (startValue != null) fields.add(Map.of("field", Map.of("id", "START"), "date", startValue));
    if (dueValue != null)
      fields.add(
          Map.of("field", Map.of("id", fieldPages ? "UNRELATED" : "TARGET"), "date", dueValue));
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
            Map.of("nameWithOwner", moveConnected && n == 1 ? "acme/mobile" : "acme/web")),
        "fieldValues",
        Map.of(
            "pageInfo",
            fieldPages
                ? Map.of("hasNextPage", true, "endCursor", "FIELD_PAGE")
                : Map.of("hasNextPage", false),
            "nodes",
            fields));
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
      ScriptUtils.executeSqlScript(
          connection, new ClassPathResource("db/issue-schema/issue-sync-jobs.sql"));
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
        "INSERT INTO github_repos(id,github_repo_id,owner_login,name,full_name,deleted_at,created_at,updated_at)"
            + " VALUES(100,1000,'acme','web','acme/web',NULL,now(),now()),"
            + "(200,2000,'other','private','other/private',NULL,now(),now())");
    jdbc.update("INSERT INTO team_repos VALUES(1,10,100),(2,20,200)");
    jdbc.update(
        "INSERT INTO team_members(id,team_id,user_id,role,left_at)"
            + " VALUES(1,10,1,'MEMBER',NULL),(2,10,2,'MEMBER',now()),(3,20,1,'MEMBER',NULL)");
    jdbc.update(
        "INSERT INTO team_project_boards"
            + " VALUES(1,10,'BOARD','STATUS','START','TARGET'),(2,20,'OTHERBOARD','STATUS','START','TARGET')");
    jdbc.update("INSERT INTO board_status_mappings VALUES(1,1,'READY','TODO')");
    for (String key : redis.keys("issues:*")) redis.delete(key);
    redirectLocation = null;
    moveConnected = false;
    movedIdentityWrong = false;
    emptyChildren = false;
    selfChild = false;
    rateLimited = false;
    editedAssignees = null;
    editedLabels = null;
    editedState = null;
    boardOption = "READY";
    startValue = "2026-11-01";
    dueValue = "2026-11-05";
    ignoreEdit = false;
    failDueOnce = false;
    redirectDetail = false;
    missingDetail = false;
    failAfterEditOnce = false;
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
    assertThatThrownBy(
            () ->
                handler.handle(
                    GithubWebhookDelivery.received(
                        "bad",
                        "issues",
                        "edited",
                        999L,
                        delivery.getPayload().replace("500", "999"))))
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
    redirectLocation = null;
    moveConnected = false;
    movedIdentityWrong = false;
    emptyChildren = false;
    selfChild = false;
    rateLimited = false;
    editedAssignees = null;
    editedLabels = null;
    editedState = null;
    boardOption = "READY";
    startValue = "2026-11-01";
    dueValue = "2026-11-05";
    ignoreEdit = false;
    failDueOnce = false;
    redirectDetail = false;
    missingDetail = false;
    failAfterEditOnce = false;
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
    assertThatThrownBy(
            () ->
                new TransactionTemplate(manager)
                    .execute(tx -> source.list(repo, "installation-read")))
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
    assertThatThrownBy(
            () ->
                cache.apply(
                    old,
                    new IssueSource.Snapshot(
                        List.of(
                            new IssueSource.RepositoryIssues(old.repos().getFirst(), List.of())),
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

  long firstIssue() {
    sync.initialSync(10);
    return jdbc.queryForObject("SELECT id FROM issues WHERE number=1", Long.class);
  }

  String detailUrl(long id) {
    return "/api/v1/user/teams/10/issues/" + id;
  }

  @Test
  void page12DetailUsesInternalIdAndSafeMarkdown() throws Exception {
    long id = firstIssue();
    mvc.perform(get(detailUrl(id)).cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(id))
        .andExpect(jsonPath("$.canWrite").value(true))
        .andExpect(jsonPath("$.repoName").value("acme/web"));
    assertThat(reads.detail(member(), 10, id).body())
        .doesNotContain("<script>")
        .doesNotContain("javascript:");
  }

  @Test
  void page12RejectsGuestRecruiterNonmemberAndCrossTeam() throws Exception {
    long id = firstIssue();
    mvc.perform(get(detailUrl(id))).andExpect(status().isUnauthorized());
    mvc.perform(get(detailUrl(id)).cookie(login(4))).andExpect(status().isForbidden());
    mvc.perform(get(detailUrl(id)).cookie(login(3))).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/user/teams/20/issues/" + id).cookie(login(1)))
        .andExpect(status().isNotFound());
  }

  @Test
  void page12CandidateAcceptsReadPermissionAndExcludesPendingAndFormer() throws Exception {
    long id = firstIssue();
    assertThat(reads.candidates(member(), 10, id).items())
        .extracting(p -> p.id())
        .containsExactly(1L);
    jdbc.update(
        "UPDATE team_members SET github_org_state='INVITED' WHERE team_id=10 AND user_id=1");
    assertThat(reads.candidates(member(), 10, id).items()).isEmpty();
  }

  @Test
  void page12AssigneeMaxAndUnknownCandidatesRejectedBeforeWrite() throws Exception {
    long id = firstIssue();
    mvc.perform(
            put(detailUrl(id) + "/assignees")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"userIds\":[1,2,3,4,5,6,7,8,9,10,11]}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            put(detailUrl(id) + "/assignees")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"userIds\":[2]}"))
        .andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("SELECT count(*) FROM issue_sync_jobs", Integer.class)).isZero();
  }

  @Test
  void page12AssigneeChangeVerifiesResponseAndNotifiesOnce() {
    long id = firstIssue();
    reads.assignees(member(), 10, id, List.of());
    jdbc.update("UPDATE team_members SET left_at=NULL WHERE team_id=10 AND user_id=2");
    assertThat(reads.assignees(member(), 10, id, List.of(2L)).assignees())
        .extracting(a -> a.id())
        .containsExactly(2L);
    details.retryDue();
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM notifications WHERE user_id=2 AND"
                    + " notification_type='ISSUE_ASSIGNED'",
                Integer.class))
        .isEqualTo(1);
    reads.assignees(member(), 10, id, List.of(2L));
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM notifications WHERE user_id=2 AND"
                    + " notification_type='ISSUE_ASSIGNED'",
                Integer.class))
        .isEqualTo(1);
  }

  @Test
  void page12SilentlyIgnoredAssigneeWriteDoesNotSucceed() {
    long id = firstIssue();
    ignoreEdit = true;
    assertThatThrownBy(() -> reads.assignees(member(), 10, id, List.of(1L)))
        .isInstanceOf(ApiException.class);
    assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id=?", String.class, id))
        .isEqualTo("FAILED");
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("FAILED");
  }

  @Test
  void page12RepositoryLabelsCanBeChangedAndCleared() {
    long id = firstIssue();
    assertThat(reads.labelOptions(member(), 10, id).items()).hasSize(2);
    assertThat(reads.labels(member(), 10, id, List.of("feature")).labels())
        .extracting(l -> l.name())
        .containsExactly("feature");
    assertThat(reads.labels(member(), 10, id, List.of()).labels()).isEmpty();
    assertThatThrownBy(() -> reads.labels(member(), 10, id, List.of("invented")))
        .isInstanceOf(ApiException.class)
        .extracting("status")
        .isEqualTo(400);
  }

  @Test
  void page12DateOrderAndWritePermissionChecked() throws Exception {
    long id = firstIssue();
    mvc.perform(
            put(detailUrl(id) + "/schedule")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"startDate\":\"2026-11-08\",\"dueDate\":\"2026-11-01\"}"))
        .andExpect(status().isBadRequest());
    writable = false;
    mvc.perform(
            put(detailUrl(id) + "/labels")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"labels\":[]}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void page12DatesSaveAndClearIncludingPastDates() {
    long id = firstIssue();
    assertThat(
            reads
                .schedule(
                    member(), 10, id, LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-02"))
                .dueDate())
        .isEqualTo(LocalDate.parse("2026-10-02"));
    assertThat(reads.schedule(member(), 10, id, null, null).dueDate()).isNull();
    assertThat(rowsSchedule(id)).isEqualTo(0);
  }

  int rowsSchedule(long id) {
    return jdbc.queryForObject(
        "SELECT count(*) FROM issues WHERE id=? AND (start_date IS NOT NULL OR due_date IS NOT"
            + " NULL)",
        Integer.class,
        id);
  }

  @Test
  void page12PartialDateFailureIsDurableAndRetryable() {
    long id = firstIssue();
    failDueOnce = true;
    assertThatThrownBy(
            () ->
                reads.schedule(
                    member(), 10, id, LocalDate.parse("2026-11-02"), LocalDate.parse("2026-11-09")))
        .isInstanceOf(ApiException.class);
    assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id=?", String.class, id))
        .isEqualTo("FAILED");
    sync.fullSync(10);
    assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id=?", String.class, id))
        .isEqualTo("FAILED");
    jdbc.update("UPDATE issue_sync_jobs SET next_retry_at='2020-01-01'");
    details.retryDue();
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("DONE");
    assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id=?", String.class, id))
        .isEqualTo("SYNCED");
  }

  @Test
  void page12PendingJobBlocksNewWriteAndRetryRechecksMembership() {
    long id = firstIssue();
    failDueOnce = true;
    assertThatThrownBy(() -> reads.schedule(member(), 10, id, null, null))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> reads.labels(member(), 10, id, List.of()))
        .isInstanceOf(ApiException.class)
        .extracting("status")
        .isEqualTo(409);
    jdbc.update("UPDATE team_members SET left_at=now() WHERE team_id=10 AND user_id=1");
    jdbc.update("UPDATE issue_sync_jobs SET next_retry_at='2020-01-01'");
    details.retryDue();
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("FAILED");
  }

  @Test
  void page12DoneClosesAndBlockedReopens() {
    long id = firstIssue();
    jdbc.update(
        "INSERT INTO board_status_mappings VALUES(2,1,'FINISHED','DONE'),(3,1,'STOP','BLOCKED')");
    assertThat(reads.status(member(), 10, id, "DONE").state()).isEqualTo("CLOSED");
    assertThat(reads.status(member(), 10, id, "BLOCKED").state()).isEqualTo("OPEN");
    assertThat(jdbc.queryForObject("SELECT board_status FROM issues WHERE id=?", String.class, id))
        .isEqualTo("BLOCKED");
  }

  @Test
  void page12UnknownStatusOrUnmappedOptionRejected() throws Exception {
    long id = firstIssue();
    mvc.perform(
            put(detailUrl(id) + "/status")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"status\":\"NONE\"}"))
        .andExpect(status().isBadRequest());
    assertThatThrownBy(() -> reads.status(member(), 10, id, "BLOCKED"))
        .isInstanceOf(ApiException.class)
        .extracting("status")
        .isEqualTo(409);
  }

  @Test
  void page12UnregisteredProjectCannotChangeSchedule() {
    firstIssue();
    long id = jdbc.queryForObject("SELECT id FROM issues WHERE number=2", Long.class);
    assertThatThrownBy(() -> reads.schedule(member(), 10, id, null, null))
        .isInstanceOf(ApiException.class)
        .extracting("status")
        .isEqualTo(409);
  }

  @Test
  void page12DeletedAndMovedReadStatesNeverFollowRedirect() {
    long id = firstIssue();
    redirectDetail = true;
    assertThat(reads.detail(member(), 10, id).deletedOrMoved()).isEqualTo("MOVED");
    assertThat(reads.detail(member(), 10, id).canWrite()).isFalse();
    redirectDetail = false;
    missingDetail = true;
    assertThat(reads.detail(member(), 10, id).deletedOrMoved()).isEqualTo("DELETED");
    assertThat(REQUESTS).noneMatch(v -> v.contains("repositories/999"));
  }

  @Test
  void page12SubIssuesAreReadOnlyAndRestrictedToConnectedRepos() {
    long id = firstIssue();
    var result = reads.subIssues(member(), 10, id);
    assertThat(result.total()).isEqualTo(1);
    assertThat(result.done()).isEqualTo(1);
    assertThat(result.items()).extracting(i -> i.number()).containsExactly(2);
  }

  @Test
  void page12MalformedBodiesAndUnsupportedStatusAre400() throws Exception {
    long id = firstIssue();
    mvc.perform(
            put(detailUrl(id) + "/assignees")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"userIds\":null}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            put(detailUrl(id) + "/schedule")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"startDate\":\"bad\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void page12NotificationSurvivesWriteReadbackFailureAndWebhookRefresh() {
    long id = firstIssue();
    reads.assignees(member(), 10, id, List.of());
    jdbc.update("UPDATE team_members SET left_at=NULL WHERE team_id=10 AND user_id=2");
    failAfterEditOnce = true;
    assertThatThrownBy(() -> reads.assignees(member(), 10, id, List.of(2L)))
        .isInstanceOf(ApiException.class);
    failRest = false;
    sync.fullSync(10);
    jdbc.update("UPDATE issue_sync_jobs SET next_retry_at='2020-01-01' WHERE status='PENDING'");
    details.retryDue();
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM notifications WHERE user_id=2 AND"
                    + " notification_type='ISSUE_ASSIGNED'",
                Integer.class))
        .isEqualTo(1);
    details.retryDue();
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM notifications WHERE user_id=2 AND"
                    + " notification_type='ISSUE_ASSIGNED'",
                Integer.class))
        .isEqualTo(1);
  }

  @Test
  void page12RetryRejectsAChangedBoardConnection() {
    long id = firstIssue();
    failDueOnce = true;
    assertThatThrownBy(() -> reads.schedule(member(), 10, id, null, null))
        .isInstanceOf(ApiException.class);
    jdbc.update(
        "UPDATE team_project_boards SET github_project_node_id='NEW_BOARD' WHERE team_id=10");
    jdbc.update("UPDATE issue_sync_jobs SET next_retry_at='2020-01-01'");
    REQUESTS.clear();
    details.retryDue();
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("FAILED");
    assertThat(REQUESTS).noneMatch(v -> v.contains("graphql"));
  }

  @Test
  void page12RetryIsBoundedAndDoesNotRunBeforeItsLease() {
    long id = firstIssue();
    failDueOnce = true;
    assertThatThrownBy(() -> reads.schedule(member(), 10, id, null, null))
        .isInstanceOf(ApiException.class);
    details.retryDue();
    assertThat(jdbc.queryForObject("SELECT attempts FROM issue_sync_jobs", Integer.class))
        .isEqualTo(1);
    failRest = true;
    for (int i = 0; i < 2; i++) {
      jdbc.update("UPDATE issue_sync_jobs SET next_retry_at='2020-01-01'");
      details.retryDue();
    }
    assertThat(jdbc.queryForObject("SELECT attempts FROM issue_sync_jobs", Integer.class))
        .isEqualTo(3);
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("FAILED");
    assertThat(jdbc.queryForObject("SELECT last_error FROM issue_sync_jobs", String.class))
        .isEqualTo("SERVICE_UNAVAILABLE");
    jdbc.update("UPDATE issue_sync_jobs SET next_retry_at='2020-01-01'");
    details.retryDue();
    assertThat(jdbc.queryForObject("SELECT attempts FROM issue_sync_jobs", Integer.class))
        .isEqualTo(3);
  }

  @Test
  void page12AllWriteResponsesMatchExistingScreenContract() throws Exception {
    long id = firstIssue();
    mvc.perform(
            put(detailUrl(id) + "/assignees")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"userIds\":[1]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.assignees[0].id").value(1));
    mvc.perform(
            put(detailUrl(id) + "/labels")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"labels\":[\"bug\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.labels[0].name").value("bug"));
    mvc.perform(
            put(detailUrl(id) + "/schedule")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"startDate\":null,\"dueDate\":null}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.startDate").isEmpty());
    mvc.perform(
            put(detailUrl(id) + "/status")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"status\":\"TODO\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("TODO"))
        .andExpect(jsonPath("$.state").value("OPEN"));
  }

  @Test
  void page12ReadOnlyOrSuspendedTeamsCannotMutate() throws Exception {
    long id = firstIssue();
    jdbc.update("UPDATE teams SET status='READ_ONLY' WHERE id=10");
    mvc.perform(
            put(detailUrl(id) + "/labels")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"labels\":[]}"))
        .andExpect(status().isConflict());
    assertThat(reads.detail(member(), 10, id).canWrite()).isFalse();
    jdbc.update("UPDATE teams SET status='ACTIVE' WHERE id=10");
    jdbc.update("UPDATE users SET status='SUSPENDED' WHERE id=1");
    mvc.perform(
            put(detailUrl(id) + "/labels")
                .cookie(login(1))
                .contentType("application/json")
                .content("{\"labels\":[]}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void page12StaleReadbackNeverCompletesOrReplacesNewerCache() {
    long id = firstIssue();
    jdbc.update("UPDATE issues SET github_updated_at='2026-11-05T04:00:00Z' WHERE id=?", id);
    assertThatThrownBy(() -> reads.labels(member(), 10, id, List.of("feature")))
        .isInstanceOf(ApiException.class);
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("PENDING");
    assertThat(
            jdbc.queryForObject("SELECT name FROM issue_labels WHERE issue_id=?", String.class, id))
        .isEqualTo("bug");
    updated = "2026-11-05T05:00:00Z";
    jdbc.update("UPDATE issue_sync_jobs SET next_retry_at='2020-01-01'");
    details.retryDue();
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("DONE");
    assertThat(
            jdbc.queryForObject("SELECT name FROM issue_labels WHERE issue_id=?", String.class, id))
        .isEqualTo("feature");
  }

  void connectedMove() {
    jdbc.update("INSERT INTO github_repos VALUES(300,3000,'acme','mobile',NULL)");
    jdbc.update("INSERT INTO team_repos VALUES(3,10,300)");
    redirectDetail = true;
    moveConnected = true;
    redirectLocation =
        "http://127.0.0.1:" + server.getAddress().getPort() + "/repositories/3000/issues/7";
  }

  @Test
  void page12ConnectedTransferPreservesIdentityAndRefreshesDestination() {
    long id = firstIssue();
    connectedMove();
    var moved = reads.detail(member(), 10, id);
    assertThat(moved.deletedOrMoved()).isNull();
    assertThat(moved.movedToIssueId()).isEqualTo(id);
    assertThat(moved.repoId()).isEqualTo(300);
    assertThat(moved.repoName()).isEqualTo("acme/mobile");
    assertThat(moved.number()).isEqualTo(7);
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM issues WHERE github_issue_id=101", Integer.class))
        .isEqualTo(1);
    var next = reads.detail(member(), 10, id);
    assertThat(next.deletedOrMoved()).isNull();
    assertThat(next.canWrite()).isTrue();
    assertThat(REQUESTS).noneMatch(v -> v.contains("/repositories/3000"));
  }

  @Test
  void page12RedirectNeverFetchesUnknownHostOrUnconnectedRepository() {
    long id = firstIssue();
    redirectDetail = true;
    for (String target :
        List.of(
            "http://evil.invalid/repositories/3000/issues/7",
            "http://127.0.0.1:1/repositories/3000/issues/7",
            "/repositories/999/issues/7",
            "/repos/other/private/issues/7",
            "/repositories/3000/issues/7?token=x")) {
      redirectLocation = target;
      REQUESTS.clear();
      var moved = reads.detail(member(), 10, id);
      assertThat(moved.movedToIssueId()).isNull();
      assertThat(moved.repoId()).isEqualTo(100);
      assertThat(REQUESTS)
          .noneMatch(
              v -> v.contains("mobile") || v.contains("private") || v.contains("/repositories/"));
    }
  }

  @Test
  void page12TransferRejectsDifferentGithubIdentityBeforeCacheWrite() {
    long id = firstIssue();
    connectedMove();
    movedIdentityWrong = true;
    assertThatThrownBy(() -> reads.detail(member(), 10, id)).isInstanceOf(ApiException.class);
    assertThat(jdbc.queryForObject("SELECT repo_id FROM issues WHERE id=?", Long.class, id))
        .isEqualTo(100L);
  }

  @Test
  void page12AuthorUsesLinkedGithubIdentityAndProfile() {
    long id = firstIssue();
    jdbc.update(
        "UPDATE users SET avatar_url='https://avatars.githubusercontent.com/u/101' WHERE id=1");
    var author = reads.detail(member(), 10, id).author();
    assertThat(author.id()).isEqualTo(1L);
    assertThat(author.name()).isEqualTo("김개발");
    assertThat(author.avatarUrl()).contains("/u/101");
    jdbc.update("DELETE FROM auth_identities WHERE user_id=1");
    assertThat(reads.detail(member(), 10, id).author().id()).isNull();
    assertThat(reads.detail(member(), 10, id).author().login()).isEqualTo("kim");
  }

  @Test
  void page12SubIssueSummaryAndParentLinksFollowCompleteSourceRead() {
    long id = firstIssue();
    var children = reads.subIssues(member(), 10, id);
    assertThat(children.total()).isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "SELECT sub_issues_total FROM issues WHERE id=?", Integer.class, id))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject("SELECT sub_issues_done FROM issues WHERE id=?", Integer.class, id))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT parent_issue_id FROM issues WHERE number=2", Long.class))
        .isEqualTo(id);
    emptyChildren = true;
    reads.subIssues(member(), 10, id);
    assertThat(
            jdbc.queryForObject(
                "SELECT sub_issues_total FROM issues WHERE id=?", Integer.class, id))
        .isZero();
    assertThat(jdbc.queryForObject("SELECT parent_issue_id FROM issues WHERE number=2", Long.class))
        .isNull();
  }

  @Test
  void page12MalformedChildRelationshipDoesNotOverwriteSummary() {
    long id = firstIssue();
    reads.subIssues(member(), 10, id);
    selfChild = true;
    assertThatThrownBy(() -> reads.subIssues(member(), 10, id)).isInstanceOf(ApiException.class);
    assertThat(
            jdbc.queryForObject(
                "SELECT sub_issues_total FROM issues WHERE id=?", Integer.class, id))
        .isEqualTo(1);
  }

  @Test
  void page12CrashedWorkerCannotExceedRetryLimit() {
    long id = firstIssue();
    failDueOnce = true;
    assertThatThrownBy(() -> reads.schedule(member(), 10, id, null, null))
        .isInstanceOf(ApiException.class);
    jdbc.update(
        "UPDATE issue_sync_jobs SET status='RUNNING',attempts=3,next_retry_at='2020-01-01'");
    REQUESTS.clear();
    details.retryDue();
    assertThat(jdbc.queryForObject("SELECT attempts FROM issue_sync_jobs", Integer.class))
        .isEqualTo(3);
    assertThat(jdbc.queryForObject("SELECT last_error FROM issue_sync_jobs", String.class))
        .isEqualTo("RETRY_EXHAUSTED");
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("FAILED");
    assertThat(REQUESTS).isEmpty();
  }

  @Test
  void page12MissingCandidateSchemaReturnsReadinessError() throws Exception {
    long id = firstIssue();
    jdbc.execute("ALTER TABLE team_members RENAME COLUMN github_org_state TO staged_org_state");
    try {
      mvc.perform(get(detailUrl(id) + "/assignee-candidates").cookie(login(1)))
          .andExpect(status().isServiceUnavailable())
          .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
    } finally {
      jdbc.execute("ALTER TABLE team_members RENAME COLUMN staged_org_state TO github_org_state");
    }
  }

  @Test
  void page12MutationsNeverRunExternalCallsInsideCallerTransaction() {
    long id = firstIssue();
    REQUESTS.clear();
    assertThatThrownBy(
            () ->
                new TransactionTemplate(manager)
                    .execute(s -> reads.labels(member(), 10, id, List.of())))
        .isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
    assertThat(REQUESTS).isEmpty();
  }

  @Test
  void page12GithubRateLimitRemainsRetryableAndRespectsServerDelay() {
    long id = firstIssue();
    rateLimited = true;
    assertThatThrownBy(() -> reads.labels(member(), 10, id, List.of("feature")))
        .isInstanceOf(ApiException.class)
        .extracting("status")
        .isEqualTo(429);
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("PENDING");
    var at =
        jdbc.queryForObject("SELECT next_retry_at FROM issue_sync_jobs", java.sql.Timestamp.class)
            .toInstant();
    assertThat(at).isEqualTo(Instant.parse("2026-11-05T15:32:00Z"));
    REQUESTS.clear();
    details.retryDue();
    assertThat(REQUESTS).isEmpty();
    rateLimited = false;
    jdbc.update("UPDATE issue_sync_jobs SET next_retry_at='2020-01-01'");
    details.retryDue();
    assertThat(jdbc.queryForObject("SELECT status FROM issue_sync_jobs", String.class))
        .isEqualTo("DONE");
  }

  @Autowired IssueEditJobRepository editJobs;

  @Test
  void page12LateFailureCannotRequeueAnAlreadyCommittedChange() {
    long issue = firstIssue();
    reads.labels(member(), 10, issue, List.of("feature"));
    long job = jdbc.queryForObject("SELECT id FROM issue_sync_jobs", Long.class);
    new TransactionTemplate(manager)
        .executeWithoutResult(
            status ->
                editJobs.failed(
                    job, issue, false, "LOST_COMMIT_ACK", Instant.parse("2020-01-01T00:00:00Z")));
    assertThat(editJobs.get(job).status()).isEqualTo("DONE");
    assertThat(
            jdbc.queryForObject("SELECT sync_status FROM issues WHERE id=?", String.class, issue))
        .isEqualTo("SYNCED");
    REQUESTS.clear();
    details.retryDue();
    assertThat(REQUESTS).isEmpty();
  }

  @Test
  void page12UsesExistingATokenDecryptionForActualCWriteTransport() {
    firstIssue();
    String synthetic = "synthetic-c12-user-access-token";
    String encrypted = tokenCipher.encrypt(synthetic);
    jdbc.update(
        "INSERT INTO"
            + " github_tokens(user_id,access_token_enc,access_expires_at,created_at,updated_at)"
            + " VALUES(1,?,'2099-01-01',now(),now())",
        encrypted);
    var connected = new GithubIssueClient(githubProperties, persistedTokens);
    assertThat(connected.canWrite(contexts.get(10).repos().getFirst(), 1)).isTrue();
    var result =
        connected.editIssue(contexts.get(10).repos().getFirst(), 1, Map.of("state", "closed"), 1);
    assertThat(result.state()).isEqualTo("CLOSED");
    assertThat(LAST_AUTHORIZATION.get()).isEqualTo("Bearer " + synthetic);
    assertThat(encrypted).isNotEqualTo(synthetic);
    assertThat(JSON.writeValueAsString(result)).doesNotContain(synthetic, encrypted);
  }
}
