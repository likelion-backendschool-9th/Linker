package com.linker.backend.repository.issue;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.linker.backend.dto.issue.request.IssueListQuery;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.global.security.TeamAccess;
import com.linker.backend.integration.github.*;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.IssueCreateService;
import com.linker.backend.service.user.IssueDetailService;
import com.linker.backend.service.user.IssueProgressService;
import com.linker.backend.service.user.IssueReminderService;
import com.linker.backend.service.user.IssueService;
import com.linker.backend.service.user.IssueSyncService;
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
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
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
  /** Real V24 subscriptions row: team 10 on Flex, billed to user 1. */
  private static final String FLEX_ACTIVE =
      "INSERT INTO subscriptions(id,team_id,plan,payer_user_id,billing_cycle,status,seats,"
          + "current_period_start,current_period_end,grace_until,created_at,updated_at)"
          + " VALUES(1,10,'FLEX',1,'MONTHLY','ACTIVE',1,'2026-01-01','2099-01-01',NULL,now(),now())";

  static final RsaMaterial KEYS = RsaMaterial.generate();
  static final Instant DEFAULT_NOW = Instant.parse("2026-11-05T15:30:00Z");
  static final java.util.concurrent.atomic.AtomicReference<Instant> CALENDAR_NOW =
      new java.util.concurrent.atomic.AtomicReference<>(DEFAULT_NOW);
  static volatile String deniedCalendarLogin;
  static volatile boolean failCalendarPermission;
  @Autowired IssueReminderService dueReminders;

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
  @Autowired IssueDetailService details;
  static volatile Map<String, Object> createdDraft;
  static volatile boolean createdProject,
      createLostResponse,
      hideCreated,
      failCreate,
      ignoreCreateLabels;
  static final AtomicInteger CREATIONS = new AtomicInteger();
  static volatile String templateFile, templateContent, orgTemplateContent;
  @Autowired IssueCreateService creation;
  @Autowired IssueSyncJobRepository createJobs;
  static volatile String issueTitle = "로그인 오류", updated = "2026-11-05T01:00:00Z";
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired UserRepository users;
  @Autowired AuthService sessions;
  @Autowired IssueSyncService sync;
  @Autowired IssueService reads;
  @Autowired IssueProgressService progress;
  @Autowired IssueRepository issueRepository;
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
          if (path.equals("/repos/acme/web/contents/.github/ISSUE_TEMPLATE")) {
            response =
                templateFile == null
                    ? List.of()
                    : List.of(Map.of("name", templateFile, "type", "file"));
          } else if (path.startsWith("/repos/acme/web/contents/.github/ISSUE_TEMPLATE/")) {
            response =
                Map.of(
                    "encoding",
                    "base64",
                    "size",
                    templateContent.length(),
                    "content",
                    Base64.getEncoder()
                        .encodeToString(templateContent.getBytes(StandardCharsets.UTF_8)));
          } else if (path.equals("/repos/acme/.github")) {
            response = Map.of("full_name", "acme/.github", "private", false);
          } else if (path.equals("/repos/acme/.github/contents/.github/ISSUE_TEMPLATE")) {
            response =
                orgTemplateContent == null
                    ? List.of()
                    : List.of(Map.of("name", "org.yml", "type", "file"));
          } else if (path.startsWith("/repos/acme/.github/contents/.github/ISSUE_TEMPLATE/")) {
            response =
                Map.of(
                    "encoding",
                    "base64",
                    "size",
                    orgTemplateContent.length(),
                    "content",
                    Base64.getEncoder()
                        .encodeToString(orgTemplateContent.getBytes(StandardCharsets.UTF_8)));
          } else if (path.equals("/repos/acme/web/issues")
              && exchange.getRequestMethod().equals("POST")) {
            CREATIONS.incrementAndGet();
            if (failCreate) {
              status = 403;
              response = Map.of("message", "denied");
            } else {
              var input =
                  JSON.readTree(
                      new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
              var created = issue(3);
              created.put("title", input.path("title").asString());
              created.put("body", input.path("body").asString());
              created.put("state", "open");
              created.put("closed_at", null);
              List<Object> assigned = new ArrayList<>();
              for (var a : input.path("assignees"))
                assigned.add(Map.of("id", 101, "login", a.asString()));
              created.put("assignees", assigned);
              List<Object> labels = new ArrayList<>();
              for (var label : input.path("labels"))
                labels.add(Map.of("name", label.asString(), "color", "d73a4a"));
              created.put("labels", ignoreCreateLabels ? List.of() : labels);
              createdDraft = created;
              response = created;
              if (createLostResponse) {
                status = 503;
                createLostResponse = false;
                response = Map.of("message", "lost response");
              }
            }
          } else if (path.startsWith("/repos/acme/web/issues/3/sub_issues")) {
            response = List.of();
          } else if (path.equals("/repos/acme/web/issues/3")) {
            if (exchange.getRequestMethod().equals("PATCH")) {
              var input =
                  JSON.readTree(
                      new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
              if (input.has("state")) {
                createdDraft.put("state", input.path("state").asString());
                createdDraft.put(
                    "closed_at",
                    input.path("state").asString().equals("closed")
                        ? "2026-11-05T01:00:00Z"
                        : null);
              }
            }
            response = createdDraft == null ? issue(3) : createdDraft;
          } else if (createdDraft != null
              && path.contains("/repos/acme/web/issues?state=all&since=")) {
            response = hideCreated ? List.of() : List.of(createdDraft);
          } else if (path.contains("access_tokens"))
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
            if (failCalendarPermission) {
              status = 503;
              response = Map.of("message", "unavailable");
            } else if (login.equals(deniedCalendarLogin)) {
              status = 404;
              response = Map.of("message", "not found");
            } else response = Map.of("user", Map.of("login", login), "permission", "read");
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
                    Map.of(
                        "data",
                        Map.of(
                            op,
                            Map.of(
                                "projectV2Item",
                                Map.of("id", variables.path("item").asString("ITEM1")))));
              }
            } else if (body.contains("addProjectV2ItemById")) {
              MUTATIONS.incrementAndGet();
              if (failMutation) {
                response = Map.of("errors", List.of(Map.of("message", "denied")));
              } else {
                if (JSON.readTree(body)
                    .path("variables")
                    .path("content")
                    .asString()
                    .equals("ISSUE3")) createdProject = true;
                else projectAdded = true;
                if (failAfterAdd) failRest = true;
                response =
                    Map.of(
                        "data",
                        Map.of(
                            "addProjectV2ItemById",
                            Map.of("item", Map.of("id", createdProject ? "ITEM3" : "ITEM2"))));
              }
            } else if (body.contains("projectItems(first:20)")) {
              String contentId = JSON.readTree(body).path("variables").path("id").asString("");
              var nodes = new ArrayList<Object>();
              if ("ISSUE3".equals(contentId) && createdProject) nodes.add(attached(3));
              else if ("ISSUE2".equals(contentId) && projectAdded) nodes.add(attached(2));
              response =
                  Map.of(
                      "data",
                      Map.of("node", Map.of("projectItems", Map.of("nodes", nodes))));
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
                if (createdProject) items.add(project(3));
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

  static Map<String, Object> attached(int n) {
    var item = new LinkedHashMap<String, Object>(project(n));
    item.put("project", Map.of("id", "BOARD"));
    return item;
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

  static class CalendarClock extends Clock {
    private final ZoneId zone;

    CalendarClock(ZoneId zone) {
      this.zone = zone;
    }

    @Override
    public ZoneId getZone() {
      return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return new CalendarClock(zone);
    }

    @Override
    public Instant instant() {
      return CALENDAR_NOW.get();
    }
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
      return new CalendarClock(ZoneOffset.UTC);
    }
  }

  @BeforeEach
  void seed() {
    CALENDAR_NOW.set(DEFAULT_NOW);
    deniedCalendarLogin = null;
    failCalendarPermission = false;
    createdDraft = null;
    createdProject = false;
    createLostResponse = false;
    hideCreated = false;
    failCreate = false;
    ignoreCreateLabels = false;
    CREATIONS.set(0);
    templateFile = null;
    templateContent = null;
    orgTemplateContent = null;
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
    jdbc.update("""
        INSERT INTO github_installations(id,github_installation_id,account_id,account_login,
          account_type,repository_selection,installed_by,created_at,updated_at)
        VALUES(1,500,700,'acme','Organization','ALL',1,now(),now()),
              (2,501,701,'other','Organization','ALL',1,now(),now())
        """);
    jdbc.update("""
        INSERT INTO teams(id,installation_id,github_org_id,github_org_login,status,name,
          created_by,created_at,updated_at)
        VALUES(10,1,700,'acme','ACTIVE','Acme',1,now(),now()),
              (20,2,701,'other','READ_ONLY','Read only',1,now(),now())
        """);
    jdbc.update(
        "INSERT INTO"
            + " github_repos(id,github_repo_id,owner_login,name,full_name,deleted_at,created_at,updated_at)"
            + " VALUES(100,1000,'acme','web','acme/web',NULL,now(),now()),"
            + "(200,2000,'other','private','other/private',NULL,now(),now())");
    jdbc.update("INSERT INTO team_repos(id,team_id,repo_id,connected_by,created_at,updated_at)"
        + " VALUES(1,10,100,1,now(),now()),(2,20,200,1,now(),now())");
    jdbc.update(
        "INSERT INTO team_members(id,team_id,user_id,role,left_at,github_org_state,joined_at,created_at,updated_at)"
            + " VALUES(1,10,1,'MEMBER',NULL,'MEMBER',now(),now(),now()),"
            + "(2,10,2,'MEMBER',now(),'MEMBER',now(),now(),now()),"
            + "(3,20,1,'MEMBER',NULL,'MEMBER',now(),now(),now())");
    jdbc.update(
        "INSERT INTO team_project_boards(id,team_id,github_project_node_id,status_field_id,"
            + "start_date_field_id,due_date_field_id,project_number,title,created_by_linker,"
            + "connected_by,created_at,updated_at)"
            + " VALUES(1,10,'BOARD','STATUS','START','TARGET',1,'Board',false,1,now(),now()),"
            + "(2,20,'OTHERBOARD','STATUS','START','TARGET',2,'Other',false,1,now(),now())");
    jdbc.update("INSERT INTO board_status_mappings(id,board_id,github_option_id,linker_status,"
        + "github_option_name,color,created_at,updated_at)"
        + " VALUES(1,1,'READY','TODO','Ready','GRAY',now(),now())");
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
    var first = issueRepository.list(10, query(null, null, 1), false, LocalDate.of(2026, 11, 6));
    var second =
        issueRepository.list(10, query(null, first.nextCursor(), 1), false, LocalDate.of(2026, 11, 6));
    assertThat(second.items().getFirst().id()).isNotEqualTo(first.items().getFirst().id());
    assertThat(second.total()).isEqualTo(2);
    assertThat(second.nextCursor()).isNull();
    assertThatThrownBy(
            () -> issueRepository.list(20, query(null, first.nextCursor(), 1), false, LocalDate.now()))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(
            () -> issueRepository.list(10, query("null", first.nextCursor(), 1), false, LocalDate.now()))
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
  void titleSearchMatchesPartOfTitleAndEscapesWildcards() throws Exception {
    sync.fullSync(10);
    var cookie = login(1);
    mvc.perform(get("/api/v1/user/teams/10/issues").cookie(cookie).param("q", " 로그인 "))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].title").value("로그인 오류"));
    mvc.perform(get("/api/v1/user/teams/10/issues").cookie(cookie).param("q", "%"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mvc.perform(get("/api/v1/user/teams/10/issues").cookie(cookie).param("q", "   "))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(2));
    mvc.perform(get("/api/v1/user/teams/10/issues").cookie(cookie).param("q", "가".repeat(101)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    // A cursor from one search text is not valid for another
    var first = issueRepository.list(
        10, new IssueListQuery(null, null, null, null, "오류", false, null, 1), false, LocalDate.now());
    assertThat(first.total()).isEqualTo(1);
    var page = issueRepository.list(10, query(null, null, 1), false, LocalDate.now());
    assertThatThrownBy(
            () ->
                issueRepository.list(
                    10,
                    new IssueListQuery(null, null, null, null, "오류", false, page.nextCursor(), 1),
                    false,
                    LocalDate.now()))
        .isInstanceOf(ApiException.class);
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
    issueRepository.withTeamLock(
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
    var handler = new GithubIssueWebhookHandler(sync, issueRepository);
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
    jdbc.update(FLEX_ACTIVE);
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
    var context = issueRepository.context(10);
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
    var repo = issueRepository.context(10).repos().getFirst();
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
        "INSERT INTO subscriptions(id,team_id,plan,payer_user_id,billing_cycle,status,seats,"
            + "current_period_start,current_period_end,grace_until,created_at,updated_at)"
            + " VALUES(1,10,'FLEX',1,'MONTHLY','PAST_DUE',1,'2019-12-01','2020-01-01','2099-01-01',now(),now())");
    assertThat(progress.progress(member(), 10, 14).completion().total()).isEqualTo(2);
    jdbc.update("UPDATE subscriptions SET grace_until='2020-01-01'");
    assertThatThrownBy(() -> progress.progress(member(), 10, 14))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.getCode()).isEqualTo("PLAN_LIMIT"));
  }

  @Test
  void changedTeamBindingPreventsStaleCacheCommit() {
    var old = issueRepository.context(10);
    jdbc.update("UPDATE team_project_boards SET due_date_field_id='CHANGED' WHERE team_id=10");
    assertThatThrownBy(
            () ->
                issueRepository.apply(
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
    jdbc.update(FLEX_ACTIVE);
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

  void boardIssue(
      long id,
      long team,
      long repo,
      int number,
      String state,
      String status,
      String item,
      String due,
      boolean deleted) {
    jdbc.update(
        "INSERT INTO issues(id,team_id,repo_id,github_issue_id,github_node_id,number,title,state,"
            + "board_status,project_item_id,due_date,github_updated_at,deleted_at)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?,CAST(? AS date),now(),CASE WHEN ? THEN now() END)",
        id,
        team,
        repo,
        id * 10,
        "NODE" + id,
        number,
        "보드 " + number,
        state,
        status,
        item,
        due,
        deleted);
  }

  void seedBoard() {
    boardIssue(901, 10, 100, 11, "OPEN", "TODO", "ITEM11", "2026-11-08", false);
    boardIssue(902, 10, 100, 12, "OPEN", "TODO", "ITEM12", "2026-11-01", false);
    boardIssue(903, 10, 100, 13, "OPEN", "TODO", "ITEM13", null, false);
    boardIssue(904, 10, 100, 14, "OPEN", "BLOCKED", "ITEM14", "2026-11-10", false);
    boardIssue(905, 10, 100, 15, "CLOSED", "IN_PROGRESS", "ITEM15", "2026-11-02", false);
    boardIssue(906, 10, 100, 16, "OPEN", "NONE", "ITEM16", "2026-11-07", false);
    boardIssue(907, 10, 100, 17, "OPEN", "OTHER", "ITEM17", null, false);
    boardIssue(908, 10, 100, 18, "OPEN", "TODO", null, "2026-11-03", false);
    boardIssue(909, 10, 100, 19, "OPEN", "TODO", "ITEM19", "2026-11-03", true);
    boardIssue(910, 20, 200, 20, "OPEN", "TODO", "ITEM20", "2026-11-09", false);
    jdbc.update("INSERT INTO issue_labels(issue_id,name,color) VALUES(901,'bug','d73a4a')");
    jdbc.update(
        "INSERT INTO issue_assignees(issue_id,github_user_id,github_login,user_id)"
            + " VALUES(902,101,'kim',1)");
  }

  @Test
  void page14BoardGroupsProjectIssuesIntoFiveColumnsByDueUrgency() throws Exception {
    seedBoard();
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(jsonPath("$.canWrite").value(true))
        .andExpect(jsonPath("$.writePermissionReason").doesNotExist())
        .andExpect(jsonPath("$.columns.length()").value(5))
        .andExpect(
            jsonPath("$.columns[*].status")
                .value(
                    org.hamcrest.Matchers.contains(
                        "TODO", "IN_PROGRESS", "BLOCKED", "DONE", "OTHER")))
        .andExpect(
            jsonPath("$.columns[*].label")
                .value(org.hamcrest.Matchers.contains("작업 전", "작업 중", "작업 중단", "작업 완료", "기타")))
        // Past due first, then soonest, then no due date; off-board, deleted and other teams' out
        .andExpect(
            jsonPath("$.columns[0].cards[*].number")
                .value(org.hamcrest.Matchers.contains(12, 11, 13)))
        .andExpect(jsonPath("$.columns[0].cards[0].overdue").value(true))
        .andExpect(jsonPath("$.columns[0].cards[0].assignees[0].login").value("kim"))
        .andExpect(jsonPath("$.columns[0].cards[1].labels[0].name").value("bug"))
        .andExpect(jsonPath("$.columns[1].cards.length()").value(0))
        .andExpect(
            jsonPath("$.columns[2].cards[*].number").value(org.hamcrest.Matchers.contains(14)))
        // A closed issue is done whatever its board value; done cards are never overdue
        .andExpect(
            jsonPath("$.columns[3].cards[*].number").value(org.hamcrest.Matchers.contains(15)))
        .andExpect(jsonPath("$.columns[3].cards[0].status").value("DONE"))
        .andExpect(jsonPath("$.columns[3].cards[0].overdue").value(false))
        // No Status value shows in "기타" but keeps NONE so the screen can tell it apart
        .andExpect(
            jsonPath("$.columns[4].cards[*].number").value(org.hamcrest.Matchers.contains(16, 17)))
        .andExpect(
            jsonPath("$.columns[4].cards[*].status")
                .value(org.hamcrest.Matchers.contains("NONE", "OTHER")))
        .andExpect(jsonPath("$.columns[4].cards[0].inProject").value(true));
  }

  @Test
  void page14BoardReusesPageElevenFiltersExceptStatus() throws Exception {
    seedBoard();
    var cookie = login(1);
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(cookie).param("label", "bug"))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.columns[0].cards[*].number").value(org.hamcrest.Matchers.contains(11)))
        .andExpect(jsonPath("$.columns[4].cards.length()").value(0));
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(cookie).param("assignee", "kim"))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.columns[0].cards[*].number").value(org.hamcrest.Matchers.contains(12)));
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(cookie).param("open", "true"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.columns[3].cards.length()").value(0))
        .andExpect(jsonPath("$.columns[0].cards.length()").value(3));
    // Another team's repo never widens the scope; status is not a board filter
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(cookie).param("repo", "200"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.columns[0].cards.length()").value(0));
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(cookie).param("status", "DONE"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.columns[0].cards.length()").value(3));
    for (String key : List.of("repo", "open"))
      mvc.perform(get("/api/v1/user/teams/10/board").cookie(cookie).param(key, "bad"))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(cookie).param("label", "' OR 1=1 --"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.columns[0].cards.length()").value(0));
  }

  @Test
  void page14BoardRequiresTeamMembershipAndReportsReadOnlyTeams() throws Exception {
    seedBoard();
    mvc.perform(get("/api/v1/user/teams/10/board")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(login(3)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("TEAM_ROLE_REQUIRED"));
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(login(4)))
        .andExpect(status().isForbidden());
    // A read-only team still shows its board, but no drag (Policy ch. 7, Page TODO 14)
    mvc.perform(get("/api/v1/user/teams/20/board").cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.canWrite").value(false))
        .andExpect(jsonPath("$.writePermissionReason").value("READ_ONLY_TEAM"))
        .andExpect(
            jsonPath("$.columns[0].cards[*].number").value(org.hamcrest.Matchers.contains(20)));
    writable = false;
    mvc.perform(get("/api/v1/user/teams/10/board").cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.canWrite").value(false))
        .andExpect(jsonPath("$.writePermissionReason").value("NO_REPOSITORY_WRITE_PERMISSION"));
  }

  /** Page 07 "내 이슈" fixture. KST today is 2026-11-06 (DEFAULT_NOW). */
  void seedMyIssues() {
    boardIssue(921, 10, 100, 21, "OPEN", "TODO", "ITEM21", "2026-11-01", false);
    boardIssue(922, 10, 100, 22, "OPEN", "IN_PROGRESS", "ITEM22", "2026-11-04", false);
    boardIssue(923, 10, 100, 23, "OPEN", "TODO", null, "2026-11-07", false);
    boardIssue(924, 10, 100, 24, "OPEN", "TODO", "ITEM24", null, false);
    boardIssue(925, 10, 100, 25, "OPEN", "BLOCKED", "ITEM25", "2026-11-06", false);
    boardIssue(926, 10, 100, 26, "CLOSED", "DONE", "ITEM26", "2026-10-01", false);
    boardIssue(927, 10, 100, 27, "OPEN", "TODO", "ITEM27", "2026-11-02", false);
    boardIssue(928, 10, 100, 28, "OPEN", "TODO", "ITEM28", "2026-11-03", true);
    boardIssue(929, 20, 200, 29, "OPEN", "TODO", "ITEM29", "2026-11-02", false);
    jdbc.update(
        "INSERT INTO github_repos(id,github_repo_id,owner_login,name,full_name,created_at,updated_at)"
            + " VALUES(300,3000,'acme','old','acme/old',now(),now())");
    boardIssue(930, 10, 300, 30, "OPEN", "TODO", "ITEM30", "2026-11-01", false);
    for (long issue : List.of(921L, 922L, 923L, 924L, 925L, 926L, 928L, 929L, 930L))
      jdbc.update(
          "INSERT INTO issue_assignees(issue_id,github_user_id,github_login,user_id)"
              + " VALUES(?,101,'kim',1)",
          issue);
    jdbc.update(
        "INSERT INTO issue_assignees(issue_id,github_user_id,github_login,user_id)"
            + " VALUES(927,102,'former',2),(921,999,'outsider',NULL)");
    jdbc.update("INSERT INTO issue_labels(issue_id,name,color) VALUES(921,'bug','d73a4a')");
  }

  @Test
  void page07MyIssuesListsOnlyMyOpenIssuesInTheSelectedTeamByDueUrgency() throws Exception {
    seedMyIssues();
    mvc.perform(get("/api/v1/user/me/issues").param("teamId", "10").cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(jsonPath("$.teamId").value(10))
        // Overdue oldest first, then today/soonest, then no due date. Off-board issues count too.
        .andExpect(
            jsonPath("$.items[*].number")
                .value(org.hamcrest.Matchers.contains(21, 22, 25, 23, 24)))
        .andExpect(
            jsonPath("$.items[*].overdue")
                .value(org.hamcrest.Matchers.contains(true, true, false, false, false)))
        .andExpect(jsonPath("$.items[0].repoName").value("web"))
        .andExpect(jsonPath("$.items[0].status").value("TODO"))
        .andExpect(jsonPath("$.items[0].dueDate").value("2026-11-01"))
        .andExpect(jsonPath("$.items[0].labels[0].name").value("bug"))
        // The shared 11 card keeps every assignee, including someone outside Linker.
        .andExpect(
            jsonPath("$.items[0].assignees[*].login")
                .value(org.hamcrest.Matchers.contains("kim", "outsider")))
        .andExpect(jsonPath("$.items[0].assignees[0].inTeam").value(true))
        .andExpect(jsonPath("$.items[2].inProject").value(true))
        .andExpect(jsonPath("$.items[3].inProject").value(false));
    // Another of my teams (read-only is still readable) lists only its own issues.
    mvc.perform(get("/api/v1/user/me/issues").param("teamId", "20").cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].number").value(org.hamcrest.Matchers.contains(29)));
  }

  @Test
  void page07MyIssuesIsEmptyWithoutAssignments() throws Exception {
    mvc.perform(get("/api/v1/user/me/issues").param("teamId", "10").cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(0));
  }

  @Test
  void page07MyIssuesRequiresADeveloperAndOneOfMyCurrentTeams() throws Exception {
    seedMyIssues();
    mvc.perform(get("/api/v1/user/me/issues").param("teamId", "10"))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/user/me/issues").param("teamId", "10").cookie(login(4)))
        .andExpect(status().isForbidden());
    // Not my team, a team I left, an unknown team, missing or malformed teamId: invalid filter.
    for (long user : List.of(3L, 2L))
      mvc.perform(get("/api/v1/user/me/issues").param("teamId", "10").cookie(login(user)))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    for (String teamId : List.of("999", "0", "abc"))
      mvc.perform(get("/api/v1/user/me/issues").param("teamId", teamId).cookie(login(1)))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    mvc.perform(get("/api/v1/user/me/issues").cookie(login(1)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  void page07MyIssuesOpenApiIsTaggedForTheWorkspace() throws Exception {
    mvc.perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paths['/api/v1/user/me/issues'].get.tags[0]").value("p07-workspace"))
        .andExpect(
            jsonPath("$.paths['/api/v1/user/me/issues'].get.operationId").value("getMyIssues"))
        .andExpect(jsonPath("$.paths['/api/v1/user/me/teams'].get.tags[0]").value("p07-workspace"))
        // Moving the class mapping to /user kept every team issue URL.
        .andExpect(
            jsonPath("$.paths['/api/v1/user/teams/{teamId}/issues/{issueId}/status'].put.tags[0]")
                .value("p12-issue-detail"));
  }

  @Test
  void page14OpenApiTagsTheBoardAndWritesTheClientInput() throws Exception {
    var result =
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams/{teamId}/board'].get.tags[0]")
                    .value("p14-board"))
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams/{teamId}/board'].get.operationId")
                    .value("getTeamIssueBoard"))
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams/{teamId}/issues'].get.tags[0]")
                    .value("p11-issue-list"))
            .andReturn();
    Path path = Path.of("build/openapi/page14.json");
    Files.createDirectories(path.getParent());
    Files.writeString(path, result.getResponse().getContentAsString(StandardCharsets.UTF_8));
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
  void page14MemberWithoutRepoWriteCanMoveStatus() {
    long id = firstIssue();
    jdbc.update(
        "INSERT INTO board_status_mappings(id,board_id,github_option_id,linker_status,"
            + "github_option_name,color,created_at,updated_at)"
            + " VALUES(2,1,'FINISHED','DONE','Done','GREEN',now(),now())");
    writable = false;
    try {
      assertThat(reads.status(member(), 10, id, "DONE").state()).isEqualTo("CLOSED");
      assertThatThrownBy(() -> reads.labels(member(), 10, id, List.of()))
          .isInstanceOf(ApiException.class)
          .extracting("status")
          .isEqualTo(403);
    } finally {
      writable = true;
    }
  }

  @Test
  void page12DoneClosesAndBlockedReopens() {
    long id = firstIssue();
    jdbc.update(
        "INSERT INTO board_status_mappings(id,board_id,github_option_id,linker_status,"
            + "github_option_name,color,created_at,updated_at)"
            + " VALUES(2,1,'FINISHED','DONE','Done','GREEN',now(),now()),"
            + "(3,1,'STOP','BLOCKED','Blocked','RED',now(),now())");
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
    jdbc.update(
        "INSERT INTO"
            + " github_repos(id,github_repo_id,owner_login,name,full_name,deleted_at,created_at,updated_at)"
            + " VALUES(300,3000,'acme','mobile','acme/mobile',NULL,now(),now())");
    jdbc.update("INSERT INTO team_repos(id,team_id,repo_id,connected_by,created_at,updated_at)"
        + " VALUES(3,10,300,1,now(),now())");
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

  @Autowired IssueSyncJobRepository editJobs;

  @Test
  void page12LateFailureCannotRequeueAnAlreadyCommittedChange() {
    long issue = firstIssue();
    reads.labels(member(), 10, issue, List.of("feature"));
    long job = jdbc.queryForObject("SELECT id FROM issue_sync_jobs", Long.class);
    new TransactionTemplate(manager)
        .executeWithoutResult(
            status ->
                editJobs.failEdit(
                    job, issue, false, "LOST_COMMIT_ACK", Instant.parse("2020-01-01T00:00:00Z")));
    assertThat(editJobs.edit(job).status()).isEqualTo("DONE");
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
    assertThat(connected.canWrite(issueRepository.context(10).repos().getFirst(), 1)).isTrue();
    var result =
        connected.editIssue(issueRepository.context(10).repos().getFirst(), 1, Map.of("state", "closed"), 1);
    assertThat(result.state()).isEqualTo("CLOSED");
    assertThat(LAST_AUTHORIZATION.get()).isEqualTo("Bearer " + synthetic);
    assertThat(encrypted).isNotEqualTo(synthetic);
    assertThat(JSON.writeValueAsString(result)).doesNotContain(synthetic, encrypted);
  }

  private String createUrl() {
    return "/api/v1/user/teams/10/issues";
  }

  private Map<String, Object> createInput(String key) {
    var r = new LinkedHashMap<String, Object>();
    r.put("requestId", key);
    r.put("repoId", 100);
    r.put("title", "가입 오류 수정");
    r.put("body", "재현 방법을 확인해 주세요.");
    r.put("assigneeIds", List.of(1));
    r.put("labels", List.of("bug"));
    r.put("startDate", "2026-11-06");
    r.put("dueDate", "2026-11-07");
    r.put("status", "TODO");
    return r;
  }

  private long submitCreate(Map<String, Object> input) throws Exception {
    var body =
        mvc.perform(
                post(createUrl())
                    .cookie(login(1))
                    .contentType("application/json")
                    .content(JSON.writeValueAsBytes(input)))
            .andExpect(status().isAccepted())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return JSON.readTree(body).path("jobId").asLong();
  }

  private void makeDue(long id) {
    jdbc.update("UPDATE issue_sync_jobs SET next_retry_at=now()-interval '20 days' WHERE id=?", id);
    creation.retryDue();
  }

  @Test
  void createTemplatesIncludeDefaultsAndPreIssueOptions() throws Exception {
    mvc.perform(
            get("/api/v1/user/teams/10/issue-templates").param("repoId", "100").cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.templates.length()").value(3))
        .andExpect(jsonPath("$.templates[0].key").value("default:bug"))
        .andExpect(jsonPath("$.assigneeCandidates[0].id").value(1))
        .andExpect(jsonPath("$.maxAssignees").value(10));
    assertThat(REQUESTS).noneMatch(r -> r.contains("issues/0"));
  }

  @Test
  void repositoryTemplateWinsAndDefaultsRemain() throws Exception {
    templateFile = "bug.yml";
    templateContent =
        "name: 저장소 양식\nbody:\n  - type: input\n    id: symptom\n    attributes:\n      label: 증상\n";
    orgTemplateContent = templateContent.replace("저장소 양식", "조직 양식");
    var result =
        mvc.perform(
                get("/api/v1/user/teams/10/issue-templates")
                    .param("repoId", "100")
                    .cookie(login(1)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.templates.length()").value(4))
            .andExpect(jsonPath("$.templates[0].source").value("REPOSITORY"))
            .andReturn();
    String key =
        JSON.readTree(result.getResponse().getContentAsString())
            .path("templates")
            .get(0)
            .path("key")
            .asString();
    mvc.perform(
            get("/api/v1/user/teams/10/issue-templates/" + key)
                .param("repoId", "100")
                .cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.fields[0].id").value("symptom"));
    assertThat(REQUESTS).noneMatch(r -> r.contains("/repos/acme/.github"));
  }

  @Test
  void organizationTemplatesAreInheritedOnlyWithoutRepositoryFiles() throws Exception {
    orgTemplateContent = "name: 조직 양식\nbody:\n  - type: input\n    attributes:\n      label: 내용\n";
    mvc.perform(
            get("/api/v1/user/teams/10/issue-templates").param("repoId", "100").cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.templates[0].source").value("ORGANIZATION"));
  }

  @Test
  void brokenTemplateDetailFallsBackWithoutSubmittingItSilently() throws Exception {
    templateFile = "bad.yml";
    templateContent = "name: [broken";
    mvc.perform(
            get("/api/v1/user/teams/10/issue-templates/missing")
                .param("repoId", "100")
                .cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.fallback").value(true));
    var input = createInput(UUID.randomUUID().toString());
    input.put("templateKey", "missing");
    mvc.perform(
            post(createUrl())
                .cookie(login(1))
                .contentType("application/json")
                .content(JSON.writeValueAsBytes(input)))
        .andExpect(status().isConflict());
    assertThat(CREATIONS.get()).isZero();
  }

  @Test
  void creationCompletesAndLinksToRealDetailWithInternalId() throws Exception {
    long job = submitCreate(createInput(UUID.randomUUID().toString()));
    assertThat(createJobs.creation(job).status()).isEqualTo("DONE");
    assertThat(CREATIONS.get()).isEqualTo(1);
    long issue = createJobs.creation(job).issue();
    assertThat(
            jdbc.queryForObject("SELECT github_issue_id FROM issues WHERE id=?", Long.class, issue))
        .isEqualTo(103);
    mvc.perform(get("/api/v1/user/teams/10/issue-sync-jobs/" + job).cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.detailPath").value("/teams/10/issues/" + issue));
    mvc.perform(get("/api/v1/user/teams/10/issues/" + issue).cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("가입 오류 수정"));
    assertThat(jdbc.queryForObject("SELECT count(*) FROM notifications", Integer.class)).isZero();
  }

  @Test
  void sameDraftReplayNeverCreatesTwice() throws Exception {
    var input = createInput(UUID.randomUUID().toString());
    long id = submitCreate(input);
    assertThat(submitCreate(input)).isEqualTo(id);
    assertThat(CREATIONS.get()).isEqualTo(1);
  }

  @Test
  void reusedDraftKeyWithChangedContentIsConflict() throws Exception {
    var input = createInput(UUID.randomUUID().toString());
    submitCreate(input);
    input.put("title", "다른 내용");
    mvc.perform(
            post(createUrl())
                .cookie(login(1))
                .contentType("application/json")
                .content(JSON.writeValueAsBytes(input)))
        .andExpect(status().isConflict());
    assertThat(CREATIONS.get()).isEqualTo(1);
  }

  @Test
  void projectFailureResumesWithoutCreatingAnotherIssue() throws Exception {
    failMutation = true;
    long id = submitCreate(createInput(UUID.randomUUID().toString()));
    assertThat(createJobs.creation(id).status()).isEqualTo("PENDING");
    assertThat(createJobs.creation(id).issue()).isNotNull();
    failMutation = false;
    makeDue(id);
    assertThat(createJobs.creation(id).status()).isEqualTo("DONE");
    assertThat(CREATIONS.get()).isEqualTo(1);
  }

  @Test
  void dateFailureResumesUsingExistingProjectItem() throws Exception {
    failDueOnce = true;
    long id = submitCreate(createInput(UUID.randomUUID().toString()));
    assertThat(createJobs.creation(id).status()).isEqualTo("PENDING");
    makeDue(id);
    assertThat(createJobs.creation(id).status()).isEqualTo("DONE");
    assertThat(CREATIONS.get()).isEqualTo(1);
    assertThat(MUTATIONS.get()).isEqualTo(1);
  }

  @Test
  void lostCreationResponseFindsMarkerAndNeverReposts() throws Exception {
    createLostResponse = true;
    long id = submitCreate(createInput(UUID.randomUUID().toString()));
    assertThat(createJobs.creation(id).issue()).isNull();
    assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isZero();
    makeDue(id);
    assertThat(createJobs.creation(id).status()).isEqualTo("DONE");
    assertThat(CREATIONS.get()).isEqualTo(1);
  }

  @Test
  void unresolvedCreationOutcomeStopsRatherThanDuplicate() throws Exception {
    createLostResponse = true;
    hideCreated = true;
    long id = submitCreate(createInput(UUID.randomUUID().toString()));
    makeDue(id);
    assertThat(createJobs.creation(id).status()).isEqualTo("FAILED");
    assertThat(createJobs.creation(id).error()).isEqualTo("CREATE_OUTCOME_UNKNOWN");
    assertThat(CREATIONS.get()).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isZero();
  }

  @Test
  void deniedCreateNeverCreatesLocalIssueOrRetries() throws Exception {
    failCreate = true;
    long id = submitCreate(createInput(UUID.randomUUID().toString()));
    assertThat(createJobs.creation(id).status()).isEqualTo("FAILED");
    makeDue(id);
    assertThat(CREATIONS.get()).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isZero();
  }

  @Test
  void invalidDatesLabelsAndFormerMemberAreRejectedBeforePost() throws Exception {
    for (String kind : List.of("dates", "labels", "member")) {
      var input = createInput(UUID.randomUUID().toString());
      if (kind.equals("dates")) input.put("startDate", "2026-11-08");
      if (kind.equals("labels")) input.put("labels", List.of("unknown"));
      if (kind.equals("member")) input.put("assigneeIds", List.of(2));
      mvc.perform(
              post(createUrl())
                  .cookie(login(1))
                  .contentType("application/json")
                  .content(JSON.writeValueAsBytes(input)))
          .andExpect(status().isBadRequest());
    }
    assertThat(CREATIONS.get()).isZero();
  }

  @Test
  void missingWriteAndForeignRepoAreRejected() throws Exception {
    var input = createInput(UUID.randomUUID().toString());
    input.put("repoId", 200);
    mvc.perform(
            post(createUrl())
                .cookie(login(1))
                .contentType("application/json")
                .content(JSON.writeValueAsBytes(input)))
        .andExpect(status().isNotFound());
    writable = false;
    input.put("repoId", 100);
    mvc.perform(
            post(createUrl())
                .cookie(login(1))
                .contentType("application/json")
                .content(JSON.writeValueAsBytes(input)))
        .andExpect(status().isForbidden());
    assertThat(CREATIONS.get()).isZero();
  }

  @Test
  void creationRequiresLoginDeveloperAndTeamMembership() throws Exception {
    byte[] body = JSON.writeValueAsBytes(createInput(UUID.randomUUID().toString()));
    mvc.perform(post(createUrl()).contentType("application/json").content(body))
        .andExpect(status().isUnauthorized());
    for (int user : List.of(3, 4))
      mvc.perform(
              post(createUrl()).cookie(login(user)).contentType("application/json").content(body))
          .andExpect(status().isForbidden());
  }

  @Test
  void creationQuotaUsesPersistedKstDayAndReplayDoesNotCountTwice() throws Exception {
    long job = submitCreate(createInput(UUID.randomUUID().toString()));
    for (int i = 0; i < 99; i++)
      jdbc.update(
          "INSERT INTO"
              + " issue_sync_jobs(team_id,requested_by,request_key,step,payload,status,created_at)"
              + " VALUES(10,1,?,'CREATE','{}','FAILED',?)",
          UUID.randomUUID(),
          java.sql.Timestamp.from(Instant.parse("2026-11-05T15:30:00Z")));
    mvc.perform(
            post(createUrl())
                .cookie(login(1))
                .contentType("application/json")
                .content(JSON.writeValueAsBytes(createInput(UUID.randomUUID().toString()))))
        .andExpect(status().isTooManyRequests());
    assertThat(CREATIONS.get()).isEqualTo(1);
  }

  @Test
  void connectionChangeStopsRetryWithoutAnotherCreate() throws Exception {
    failMutation = true;
    long id = submitCreate(createInput(UUID.randomUUID().toString()));
    jdbc.update("UPDATE team_project_boards SET github_project_node_id='CHANGED' WHERE team_id=10");
    makeDue(id);
    assertThat(CREATIONS.get()).isEqualTo(1);
    assertThat(createJobs.creation(id).status()).isNotEqualTo("DONE");
  }

  @Test
  void creationRetriesAreBoundedAndExcludedFromEditWorker() throws Exception {
    failMutation = true;
    long id = submitCreate(createInput(UUID.randomUUID().toString()));
    details.retryDue();
    assertThat(CREATIONS.get()).isEqualTo(1);
    makeDue(id);
    makeDue(id);
    makeDue(id);
    assertThat(createJobs.creation(id).status()).isEqualTo("FAILED");
    assertThat(createJobs.creation(id).attempts()).isEqualTo(3);
    assertThat(CREATIONS.get()).isEqualTo(1);
  }

  @Test
  void formCreationRendersAnswersAndAppliesTemplateLabels() throws Exception {
    templateFile = "bug.yml";
    templateContent =
        "name: 오류 양식\n"
            + "labels: [bug]\n"
            + "body:\n"
            + "  - type: input\n"
            + "    id: symptom\n"
            + "    attributes:\n"
            + "      label: 증상\n"
            + "    validations:\n"
            + "      required: true\n"
            + "  - type: textarea\n"
            + "    id: extra\n"
            + "    attributes:\n"
            + "      label: 추가 내용\n";
    var input = createInput(UUID.randomUUID().toString());
    input.put(
        "templateKey",
        "repo:"
            + Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString("bug.yml".getBytes(StandardCharsets.UTF_8)));
    input.remove("labels");
    input.put("answers", Map.of("symptom", List.of("가입 실패")));
    long job = submitCreate(input);
    assertThat(createJobs.creation(job).status()).isEqualTo("DONE");
    assertThat((String) createdDraft.get("body"))
        .contains("### 증상\n\n가입 실패", "### 추가 내용\n\n_No response_");
    mvc.perform(get("/api/v1/user/teams/10/issues/" + createJobs.creation(job).issue()).cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.body")
                .value(
                    org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("linker-create:"))));
  }

  @Test
  void missingRequiredFormAnswerDoesNotCreateGithubIssue() throws Exception {
    templateFile = "bug.yml";
    templateContent =
        "name: 오류 양식\n"
            + "body:\n"
            + "  - type: input\n"
            + "    id: symptom\n"
            + "    attributes:\n"
            + "      label: 증상\n"
            + "    validations:\n"
            + "      required: true\n";
    var input = createInput(UUID.randomUUID().toString());
    input.put(
        "templateKey",
        "repo:"
            + Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString("bug.yml".getBytes(StandardCharsets.UTF_8)));
    mvc.perform(
            post(createUrl())
                .cookie(login(1))
                .contentType("application/json")
                .content(JSON.writeValueAsBytes(input)))
        .andExpect(status().isBadRequest());
    assertThat(CREATIONS.get()).isZero();
  }

  @Test
  void creationJobCannotBeReadThroughAnotherTeam() throws Exception {
    long job = submitCreate(createInput(UUID.randomUUID().toString()));
    mvc.perform(get("/api/v1/user/teams/20/issue-sync-jobs/" + job).cookie(login(1)))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/user/teams/10/issue-sync-jobs/" + job).cookie(login(3)))
        .andExpect(status().isForbidden());
  }

  @Test
  void githubDroppingCreationMetadataIsNotReportedAsSuccess() throws Exception {
    ignoreCreateLabels = true;
    long job = submitCreate(createInput(UUID.randomUUID().toString()));
    assertThat(createJobs.creation(job).status()).isNotEqualTo("DONE");
    assertThat(CREATIONS.get()).isEqualTo(1);
    makeDue(job);
    assertThat(CREATIONS.get()).isEqualTo(1);
  }

  @Test
  void openApiPublishesOnlyFourP13OperationsWithAcceptedResponse() throws Exception {
    var body =
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams/{teamId}/issues'].post.responses['202']")
                    .exists())
            .andReturn()
            .getResponse()
            .getContentAsString();
    var paths = JSON.readTree(body).path("paths");
    long count = 0;
    for (var entry : paths.properties())
      for (var operation : entry.getValue())
        if (operation.path("tags").isArray())
          for (var tag : operation.path("tags"))
            if (tag.asString().equals("p13-issue-create")) count++;
    assertThat(count).isEqualTo(4);
  }

  @Test
  void missingStatusFieldIsRejectedBeforeCreatingGithubIssue() throws Exception {
    jdbc.update("UPDATE team_project_boards SET status_field_id='' WHERE team_id=10");
    mvc.perform(
            post(createUrl())
                .cookie(login(1))
                .contentType("application/json")
                .content(JSON.writeValueAsBytes(createInput(UUID.randomUUID().toString()))))
        .andExpect(status().isConflict());
    assertThat(CREATIONS.get()).isZero();
  }

  private String calendarUrl() {
    return "/api/v1/user/teams/10/calendar";
  }

  private void calendarIssue(long id, int number, String start, String due) {
    boardIssue(id, 10, 100, number, "OPEN", "TODO", "ITEM" + id, due, false);
    jdbc.update("UPDATE issues SET start_date=CAST(? AS date) WHERE id=?", start, id);
  }

  private void seedCalendar() {
    calendarIssue(1001, 21, "2026-10-30", "2026-11-04");
    calendarIssue(1002, 22, null, "2026-11-02");
    calendarIssue(1003, 23, "2026-11-28", "2026-12-03");
    calendarIssue(1004, 24, "2026-10-01", "2026-12-30");
    calendarIssue(1005, 25, "2026-12-01", "2026-12-08");
    calendarIssue(1006, 26, "2026-10-15", "2026-10-31");
    calendarIssue(1007, 27, "2026-11-11", null);
    calendarIssue(1008, 28, null, "2026-11-09");
    jdbc.update("UPDATE issues SET project_item_id=NULL WHERE id=1008");
    calendarIssue(1009, 29, null, "2026-11-07");
    jdbc.update("UPDATE issues SET deleted_at=now() WHERE id=1009");
    boardIssue(1010, 20, 200, 30, "OPEN", "TODO", "OTHER", "2026-11-05", false);
    calendarIssue(1011, 31, null, "2026-11-05");
    jdbc.update("UPDATE issues SET state='CLOSED',board_status='DONE' WHERE id=1011");
    calendarIssue(1012, 32, null, "2026-11-05");
    jdbc.update("UPDATE issues SET board_status='BLOCKED' WHERE id=1012");
    jdbc.update(
        "INSERT INTO issue_assignees(issue_id,github_user_id,github_login,user_id)"
            + " VALUES(1002,101,'kim',1),(1003,102,'former',2)");
  }

  @Test
  void page15CalendarIncludesOverlappingBarsAndDueOnlyDots() throws Exception {
    seedCalendar();
    var body =
        mvc.perform(
                get(calendarUrl())
                    .param("from", "2026-11-01")
                    .param("to", "2026-11-30")
                    .cookie(login(1)))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.from").value("2026-11-01"))
            .andExpect(jsonPath("$.to").value("2026-11-30"))
            .andExpect(
                jsonPath("$.items[*].id")
                    .value(
                        org.hamcrest.Matchers.containsInAnyOrder(
                            1001, 1002, 1003, 1004, 1011, 1012)))
            .andReturn()
            .getResponse()
            .getContentAsString();
    var parsed = JSON.readTree(body);
    var bar =
        java.util.stream.StreamSupport.stream(parsed.path("items").spliterator(), false)
            .filter(i -> i.path("id").asLong() == 1001)
            .findFirst()
            .orElseThrow();
    assertThat(bar.path("startDate").asString()).isEqualTo("2026-10-30");
    assertThat(bar.path("dueDate").asString()).isEqualTo("2026-11-04");
    var dot =
        java.util.stream.StreamSupport.stream(parsed.path("items").spliterator(), false)
            .filter(i -> i.path("id").asLong() == 1002)
            .findFirst()
            .orElseThrow();
    assertThat(dot.path("startDate").isNull()).isTrue();
  }

  @Test
  void page15CalendarHandlesSingleDayAndMonthWeekBoundaries() throws Exception {
    seedCalendar();
    mvc.perform(
            get(calendarUrl())
                .param("from", "2026-11-02")
                .param("to", "2026-11-02")
                .cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.items[*].id")
                .value(org.hamcrest.Matchers.containsInAnyOrder(1001, 1002, 1004)));
    mvc.perform(
            get(calendarUrl())
                .param("from", "2026-11-30")
                .param("to", "2026-12-01")
                .cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.items[*].id")
                .value(org.hamcrest.Matchers.containsInAnyOrder(1003, 1004, 1005)));
  }

  @Test
  void page15CalendarFiltersAssigneeAndTreatsInjectionAsAValue() throws Exception {
    seedCalendar();
    mvc.perform(
            get(calendarUrl())
                .param("from", "2026-11-01")
                .param("to", "2026-11-30")
                .param("assignee", "kim")
                .cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].id").value(org.hamcrest.Matchers.contains(1002)))
        .andExpect(jsonPath("$.items[0].assignees[0].login").value("kim"));
    mvc.perform(
            get(calendarUrl())
                .param("from", "2026-11-01")
                .param("to", "2026-11-30")
                .param("assignee", "' OR 1=1 --")
                .cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(0));
    jdbc.update("UPDATE github_repos SET deleted_at=now() WHERE id=100");
    mvc.perform(
            get(calendarUrl())
                .param("from", "2026-11-01")
                .param("to", "2026-11-30")
                .cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(0));
  }

  @Test
  void page15OverdueUsesKstDayAndClosedIssuesStayNotOverdue() throws Exception {
    seedCalendar();
    var body =
        mvc.perform(
                get(calendarUrl())
                    .param("from", "2026-11-05")
                    .param("to", "2026-11-05")
                    .cookie(login(1)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    for (var item : JSON.readTree(body).path("items")) {
      if (item.path("id").asLong() == 1012) assertThat(item.path("overdue").asBoolean()).isTrue();
      if (item.path("id").asLong() == 1011) {
        assertThat(item.path("overdue").asBoolean()).isFalse();
        assertThat(item.path("status").asString()).isEqualTo("DONE");
      }
    }
    assertThat(DEFAULT_NOW.atZone(ZoneOffset.UTC).toLocalDate())
        .isEqualTo(LocalDate.parse("2026-11-05"));
  }

  @Test
  void page15CalendarRequiresDatesAndRejectsInvalidRange() throws Exception {
    mvc.perform(get(calendarUrl()).param("to", "2026-11-30").cookie(login(1)))
        .andExpect(status().isBadRequest());
    for (String[] dates :
        List.of(
            new String[] {"2026-11-30", "2026-11-01"},
            new String[] {"bad", "2026-11-30"},
            new String[] {"2026-02-30", "2026-11-30"},
            new String[] {"0000-01-01", "2026-11-30"}))
      mvc.perform(get(calendarUrl()).param("from", dates[0]).param("to", dates[1]).cookie(login(1)))
          .andExpect(status().isBadRequest());
    mvc.perform(
            get(calendarUrl())
                .param("from", "2026-11-01")
                .param("to", "2026-11-30")
                .param("assignee", "x".repeat(40))
                .cookie(login(1)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void page15CalendarChecksLoginRoleAndTeamWithoutGithubWrites() throws Exception {
    mvc.perform(get(calendarUrl()).param("from", "2026-11-01").param("to", "2026-11-30"))
        .andExpect(status().isUnauthorized());
    for (int user : List.of(3, 4))
      mvc.perform(
              get(calendarUrl())
                  .param("from", "2026-11-01")
                  .param("to", "2026-11-30")
                  .cookie(login(user)))
          .andExpect(status().isForbidden());
    var cookie = login(1);
    REQUESTS.clear();
    mvc.perform(
            get("/api/v1/user/teams/20/calendar")
                .param("from", "2026-11-01")
                .param("to", "2026-11-30")
                .cookie(cookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(0));
    assertThat(REQUESTS).isEmpty();
  }

  @Test
  void page15CalendarOpenApiAddsOnlyItsReadOperation() throws Exception {
    var result =
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams/{teamId}/calendar'].get.tags[0]")
                    .value("p15-calendar"))
            .andExpect(
                jsonPath("$.paths['/api/v1/user/teams/{teamId}/calendar'].get.operationId")
                    .value("getTeamIssueCalendar"))
            .andReturn();
    Path path = Path.of("build/openapi/page15.json");
    Files.createDirectories(path.getParent());
    Files.writeString(path, result.getResponse().getContentAsString(StandardCharsets.UTF_8));
  }

  private void dueAssignment(long issue, long github, String login, Long user) {
    jdbc.update(
        "INSERT INTO issue_assignees(issue_id,github_user_id,github_login,user_id) VALUES(?,?,?,?)",
        issue,
        github,
        login,
        user);
  }

  private void dueAtNine() {
    CALENDAR_NOW.set(Instant.parse("2026-11-06T00:00:00Z"));
  }

  private void seedDue() {
    calendarIssue(2001, 41, null, "2026-11-07");
    dueAssignment(2001, 101, "kim", 1L);
  }

  @Test
  void page15ReminderRunsAtNineKstAndIsIdempotent() throws Exception {
    seedDue();
    assertThat(dueReminders.remindDueTomorrow()).isZero();
    dueAtNine();
    assertThat(dueReminders.remindDueTomorrow()).isEqualTo(1);
    assertThat(dueReminders.remindDueTomorrow()).isZero();
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM notifications WHERE notification_type='DUE_SOON'",
                Integer.class))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "SELECT link_path FROM notifications WHERE notification_type='DUE_SOON'",
                String.class))
        .isEqualTo("/teams/10/issues/2001");
    assertThat(
            jdbc.queryForObject(
                "SELECT actor_id FROM notifications WHERE notification_type='DUE_SOON'",
                Long.class))
        .isNull();
    assertThat(
            jdbc.queryForObject(
                "SELECT deliver_after FROM notifications WHERE notification_type='DUE_SOON'",
                java.sql.Timestamp.class))
        .isNull();
    var payload =
        JSON.readTree(
            jdbc.queryForObject(
                "SELECT payload::text FROM notifications WHERE notification_type='DUE_SOON'",
                String.class));
    assertThat(payload.path("dueDate").asString()).isEqualTo("2026-11-07");
  }

  @Test
  void page15ReminderExcludesClosedDoneDeletedFormerAndExternalAssignees() {
    dueAtNine();
    seedDue();
    dueAssignment(2001, 102, "former", 2L);
    dueAssignment(2001, 999, "external", null);
    calendarIssue(2002, 42, null, "2026-11-07");
    jdbc.update("UPDATE issues SET state='CLOSED' WHERE id=2002");
    dueAssignment(2002, 101, "kim", 1L);
    calendarIssue(2003, 43, null, "2026-11-07");
    jdbc.update("UPDATE issues SET board_status='DONE' WHERE id=2003");
    dueAssignment(2003, 101, "kim", 1L);
    calendarIssue(2004, 44, null, null);
    dueAssignment(2004, 101, "kim", 1L);
    calendarIssue(2005, 45, null, "2026-11-08");
    dueAssignment(2005, 101, "kim", 1L);
    calendarIssue(2006, 46, null, "2026-11-07");
    jdbc.update("UPDATE issues SET project_item_id=NULL WHERE id=2006");
    dueAssignment(2006, 101, "kim", 1L);
    calendarIssue(2007, 47, null, "2026-11-07");
    jdbc.update("UPDATE issues SET deleted_at=now() WHERE id=2007");
    dueAssignment(2007, 101, "kim", 1L);
    assertThat(dueReminders.remindDueTomorrow()).isEqualTo(1);
    assertThat(
            jdbc.queryForList(
                "SELECT user_id FROM notifications WHERE notification_type='DUE_SOON'", Long.class))
        .containsExactly(1L);
  }

  @Test
  void page15ReminderRetriesAfterPermissionFailureButNeverLeaksToRevokedUser() {
    dueAtNine();
    seedDue();
    failCalendarPermission = true;
    assertThat(dueReminders.remindDueTomorrow()).isZero();
    failCalendarPermission = false;
    deniedCalendarLogin = "kim";
    assertThat(dueReminders.remindDueTomorrow()).isZero();
    deniedCalendarLogin = null;
    assertThat(dueReminders.remindDueTomorrow()).isEqualTo(1);
  }

  @Test
  void page15ReminderRechecksMembershipAccountAndRepository() {
    dueAtNine();
    seedDue();
    jdbc.update("UPDATE team_members SET left_at=now() WHERE user_id=1 AND team_id=10");
    assertThat(dueReminders.remindDueTomorrow()).isZero();
    jdbc.update(
        "UPDATE team_members SET left_at=NULL,github_org_state='INVITED' WHERE user_id=1 AND"
            + " team_id=10");
    assertThat(dueReminders.remindDueTomorrow()).isZero();
    jdbc.update("UPDATE team_members SET github_org_state='MEMBER' WHERE user_id=1 AND team_id=10");
    jdbc.update("UPDATE users SET status='WITHDRAWING' WHERE id=1");
    assertThat(dueReminders.remindDueTomorrow()).isZero();
    jdbc.update("UPDATE users SET status='ACTIVE' WHERE id=1");
    jdbc.update("UPDATE github_repos SET deleted_at=now() WHERE id=100");
    assertThat(dueReminders.remindDueTomorrow()).isZero();
  }

  @Test
  void page15ReminderUsesDueDateAndRecipientInItsDeduplicationKey() {
    dueAtNine();
    seedDue();
    assertThat(dueReminders.remindDueTomorrow()).isEqualTo(1);
    jdbc.update("UPDATE issues SET due_date='2026-11-08' WHERE id=2001");
    assertThat(dueReminders.remindDueTomorrow()).isZero();
    CALENDAR_NOW.set(Instant.parse("2026-11-07T00:00:00Z"));
    assertThat(dueReminders.remindDueTomorrow()).isEqualTo(1);
    jdbc.update("UPDATE team_members SET left_at=NULL WHERE user_id=2 AND team_id=10");
    dueAssignment(2001, 102, "former", 2L);
    assertThat(dueReminders.remindDueTomorrow()).isEqualTo(1);
    assertThat(dueReminders.remindDueTomorrow()).isZero();
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM notifications WHERE notification_type='DUE_SOON'",
                Integer.class))
        .isEqualTo(3);
  }

  @Test
  void page15ReminderKeepsInAppNotificationWhenPushIsDisabled() throws Exception {
    dueAtNine();
    seedDue();
    jdbc.update("UPDATE users SET push_enabled=false WHERE id=1");
    assertThat(dueReminders.remindDueTomorrow()).isEqualTo(1);
    mvc.perform(get("/api/v1/user/notifications").cookie(login(1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].type").value("DUE_SOON"))
        .andExpect(jsonPath("$.items[0].targetUrl").value("/teams/10/issues/2001"));
  }

  @Test
  void page15ReminderRollsBackFailedNotificationAndCanRetry() {
    dueAtNine();
    seedDue();
    jdbc.execute(
        "CREATE FUNCTION reject_due_reminder() RETURNS trigger AS $$ BEGIN IF"
            + " NEW.notification_type='DUE_SOON' THEN RAISE EXCEPTION 'test failure'; END IF;"
            + " RETURN NEW; END; $$ LANGUAGE plpgsql");
    jdbc.execute(
        "CREATE TRIGGER reject_due BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION"
            + " reject_due_reminder()");
    try {
      assertThat(dueReminders.remindDueTomorrow()).isZero();
      assertThat(jdbc.queryForObject("SELECT count(*) FROM notifications", Integer.class)).isZero();
    } finally {
      jdbc.execute("DROP TRIGGER reject_due ON notifications");
      jdbc.execute("DROP FUNCTION reject_due_reminder()");
    }
    assertThat(dueReminders.remindDueTomorrow()).isEqualTo(1);
  }

  @Test
  void page15ConcurrentReminderWorkersProduceOnlyOneNotification() throws Exception {
    dueAtNine();
    seedDue();
    var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
    try {
      var a = pool.submit(() -> dueReminders.remindDueTomorrow());
      var b = pool.submit(() -> dueReminders.remindDueTomorrow());
      assertThat(
              a.get(20, java.util.concurrent.TimeUnit.SECONDS)
                  + b.get(20, java.util.concurrent.TimeUnit.SECONDS))
          .isEqualTo(1);
    } finally {
      pool.shutdownNow();
    }
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM notifications WHERE notification_type='DUE_SOON'",
                Integer.class))
        .isEqualTo(1);
  }
}
