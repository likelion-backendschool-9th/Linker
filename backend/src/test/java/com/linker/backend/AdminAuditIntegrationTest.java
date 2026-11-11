package com.linker.backend;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.linker.backend.entity.account.*;
import com.linker.backend.entity.account.type.*;
import com.linker.backend.entity.moderation.*;
import com.linker.backend.entity.moderation.type.*;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.*;
import com.linker.backend.repository.moderation.*;
import com.linker.backend.service.AuthService;
import jakarta.servlet.http.Cookie;
import java.time.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Testcontainers
class AdminAuditIntegrationTest {
  static final RsaMaterial KEYS=RsaMaterial.generate();
  @Container static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:16-alpine");
  @Container static final GenericContainer<?> REDIS=new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url",PG::getJdbcUrl); r.add("spring.datasource.username",PG::getUsername);
    r.add("spring.datasource.password",PG::getPassword); r.add("spring.data.redis.host",REDIS::getHost);
    r.add("spring.data.redis.port",() -> REDIS.getMappedPort(6379));
    r.add("linker.session.jwt-private-key",KEYS::privatePem);r.add("linker.session.jwt-public-key",KEYS::publicPem);
    r.add("linker.webhook.consumer-enabled",() -> "false");r.add("linker.issues.sync-enabled",() -> "false");
    r.add("linker.issues.webhook-enabled",() -> "false");r.add("spring.jpa.show-sql",() -> "false");
  }
  @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired UserRepository users;
  @Autowired AuthIdentityRepository identities; @Autowired AdminRepository admins;
  @Autowired SanctionRepository sanctions; @Autowired AuthService auth; @Autowired ObjectMapper json;
  @MockitoBean Clock clock;
  @MockitoBean com.linker.backend.integration.payment.PaymentGateway gateway;
  @Autowired com.linker.backend.repository.subscription.PaymentRepository payments;
  @Autowired com.linker.backend.repository.subscription.SubscriptionRepository subscriptions;
  @MockitoBean com.linker.backend.async.notification.NotificationDeliveryService delivery;
  @MockitoBean com.linker.backend.async.schedule.AccountSanctionExpiryJob expiry;
  Instant now; User operator,lead,target; Cookie op,root;
  @BeforeEach void setup() {
    now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
    when(clock.instant()).thenAnswer(i -> now); when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    // The preceding DB-grant test creates no login role and leaves grants only on this isolated DB.
    jdbc.execute("TRUNCATE users,github_repos,banned_github_ids RESTART IDENTITY CASCADE");
    operator=user("operator",UserType.DEVELOPER);lead=user("lead",UserType.DEVELOPER);target=user("target",UserType.DEVELOPER);
    admins.saveAndFlush(Admin.assign(operator,AdminRole.OPERATOR));admins.saveAndFlush(Admin.assign(lead,AdminRole.LEAD));
    op=verified(operator);root=verified(lead);
  }
  @Test void filtersUseStableDatabaseIdsAndActionsAndRequireOtp() throws Exception {
    mvc.perform(get("/api/v1/admin/audit-logs")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/admin/audit-logs").cookie(cookie(target))).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/admin/audit-logs").cookie(cookie(operator))).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/admin/audit-logs/filters").cookie(op)).andExpect(status().isOk())
        .andExpect(header().string("Cache-Control","no-store"))
        .andExpect(jsonPath("$.admins.length()").value(2)).andExpect(jsonPath("$.admins[0].id").isNumber())
        .andExpect(jsonPath("$.actionTypes").value(org.hamcrest.Matchers.hasItems("SANCTION","VIEW_EMAIL","APPEAL_ACCEPT")));
  }
  @Test void dateRangeIncludesBothKstDaysAndKeysetHandlesSameTimestamp() throws Exception {
    long admin=admins.findByUser_Id(operator.getId()).orElseThrow().getId();
    long other=admins.findByUser_Id(lead.getId()).orElseThrow().getId();
    add(admin,"VIEW_EMAIL","2026-11-06T14:59:59.999999Z");
    long first=add(admin,"VIEW_EMAIL","2026-11-06T15:00:00Z");
    long a=add(admin,"VIEW_EMAIL","2026-11-07T00:00:00Z");
    long b=add(admin,"VIEW_EMAIL","2026-11-07T00:00:00Z");
    long end=add(admin,"VIEW_EMAIL","2026-11-07T14:59:59.999999Z");
    add(admin,"VIEW_EMAIL","2026-11-07T15:00:00Z");add(other,"VIEW_EMAIL","2026-11-07T00:00:00Z");
    add(admin,"SANCTION","2026-11-07T00:00:00Z");
    var page=mvc.perform(get("/api/v1/admin/audit-logs").cookie(op).param("adminId",""+admin).param("actionType","VIEW_EMAIL")
        .param("from","2026-11-07").param("to","2026-11-07").param("size","2"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(end))
        .andExpect(jsonPath("$.items[1].id").value(b)).andReturn();
    String cursor=json.readTree(page.getResponse().getContentAsString()).path("nextCursor").asText();
    mvc.perform(get("/api/v1/admin/audit-logs").cookie(op).param("adminId",""+admin).param("actionType","VIEW_EMAIL")
        .param("from","2026-11-07").param("to","2026-11-07").param("size","2").param("cursor",cursor))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(a))
        .andExpect(jsonPath("$.items[1].id").value(first)).andExpect(jsonPath("$.nextCursor").doesNotExist());
    mvc.perform(get("/api/v1/admin/audit-logs").cookie(op).param("from","2026-11-08").param("to","2026-11-07")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/admin/audit-logs").cookie(op).param("from","not-a-date")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/admin/audit-logs").cookie(op).param("cursor","99999")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/admin/audit-logs").cookie(op).param("adminId","not-number")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/admin/audit-logs").cookie(op).param("actionType","EMAIL_REVEAL")).andExpect(status().isBadRequest());
  }
  @Test void accountActionsAreVisibleWithoutLeakingEmailOrArbitraryMetadata() throws Exception {
    mvc.perform(post("/api/v1/admin/users/"+target.getId()+"/email-reveal").cookie(op)
        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"회원 요청 확인\"}")).andExpect(status().isOk());
    mvc.perform(post("/api/v1/admin/users/"+target.getId()+"/sanctions").cookie(op)
        .contentType(MediaType.APPLICATION_JSON).content("{\"step\":\"WARNING\",\"reason\":\"홍보 반복\"}")).andExpect(status().isOk());
    long id=jdbc.queryForObject("select id from admin_actions where action='SANCTION'",Long.class);
    jdbc.update("update admin_actions set metadata=metadata || '{\"secret\":\"sensitive-value\"}'::jsonb where id=?",id);
    var result=mvc.perform(get("/api/v1/admin/audit-logs").cookie(root)).andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(2)).andReturn();
    assertThat(result.getResponse().getContentAsString()).contains("VIEW_EMAIL","SANCTION","WARNING","회원 요청 확인")
        .doesNotContain("target@example.com","sensitive-value");
    mvc.perform(patch("/api/v1/admin/audit-logs/"+id).cookie(root)).andExpect(status().is4xxClientError());
    mvc.perform(delete("/api/v1/admin/audit-logs/"+id).cookie(root)).andExpect(status().is4xxClientError());
    assertThat(count("admin_actions")).isEqualTo(2);
  }
  @Test void approvedNonOwnerRoleCanAppendAndReadButCannotChangeOrDeleteAuditRows() throws Exception {
    jdbc.execute("create role audit_app_test nologin nosuperuser nocreaterole");
    assertAuditProtection("audit_app_test",3);
    assertAuditProtection("audit_missing_role",3);
    var script=java.nio.file.Files.readAllBytes(java.nio.file.Path.of("../scripts/database/admin-actions-append-only.sql"));
    PG.copyFileToContainer(org.testcontainers.images.builder.Transferable.of(script),"/tmp/audit-grants.sql");
    var applied=PG.execInContainer("psql","-U",PG.getUsername(),"-d",PG.getDatabaseName(),"-v","app_role=audit_app_test","-f","/tmp/audit-grants.sql");
    assertThat(applied.getExitCode()).as(applied.getStderr()).isZero();
    assertAuditProtection("audit_app_test",0);
    assertAuditProtection(PG.getUsername(),3);
    for (String path:java.util.List.of("/tmp/audit-grants.sql","/tmp/check-audit-grants.sql")) {
      var missingRole=PG.execInContainer("psql","-X","-U",PG.getUsername(),"-d",PG.getDatabaseName(),"-f",path);
      assertThat(missingRole.getExitCode()).as(missingRole.getStdout()+missingRole.getStderr()).isEqualTo(3);
      assertThat(missingRole.getStderr()).contains("app_role is required");
    }
    assertAuditProtection("audit_app_test",0);
    long admin=admins.findByUser_Id(operator.getId()).orElseThrow().getId();
    // Real DB permissions, never a mocked repository. SET ROLE is confined to this container's session.
    var append=PG.execInContainer("psql","-U",PG.getUsername(),"-d",PG.getDatabaseName(),"-v","ON_ERROR_STOP=1","-c",
        "set role audit_app_test; insert into admin_actions(admin_id,action,target_type,target_id,reason,created_at,updated_at) values ("+admin+",'VIEW_EMAIL','USER',"+target.getId()+",'test',now(),now()); select count(*) from admin_actions;");
    assertThat(append.getExitCode()).as(append.getStderr()).isZero();
    for (String command:java.util.List.of("update admin_actions set reason='changed'","delete from admin_actions","truncate admin_actions")) {
      var denied=PG.execInContainer("psql","-U",PG.getUsername(),"-d",PG.getDatabaseName(),"-v","ON_ERROR_STOP=1","-c","set role audit_app_test; "+command);
      assertThat(denied.getExitCode()).as(command).isNotZero();assertThat(denied.getStderr()).contains("permission denied");
    }
    var owner=PG.execInContainer("psql","-U",PG.getUsername(),"-d",PG.getDatabaseName(),"-v","app_role="+PG.getUsername(),"-f","/tmp/audit-grants.sql");
    assertThat(owner.getExitCode()).isNotZero();
    // A NOINHERIT role can still SET ROLE: direct table privileges alone are insufficient.
    jdbc.execute("create role audit_owner_member nologin noinherit");
    jdbc.execute("grant audit_app_test to audit_owner_member");
    jdbc.execute("grant "+PG.getUsername()+" to audit_owner_member");
    assertThat(assertAuditProtection("audit_owner_member",3)).contains("\"owner_role_access\":true");
    jdbc.execute("create role audit_role_manager nologin createrole");
    jdbc.execute("create role audit_manager_member nologin noinherit");
    jdbc.execute("grant audit_role_manager to audit_manager_member");
    assertThat(assertAuditProtection("audit_manager_member",3)).contains("\"elevated_role_access\":true");
    var elevated=PG.execInContainer("psql","-X","-U",PG.getUsername(),"-d",PG.getDatabaseName(),
        "-v","app_role=audit_manager_member","-f","/tmp/audit-grants.sql");
    assertThat(elevated.getExitCode()).as(elevated.getStderr()).isEqualTo(3);
  }
  private String assertAuditProtection(String role,int expectedExit) throws Exception {
    var script=java.nio.file.Files.readAllBytes(java.nio.file.Path.of("../scripts/database/check-admin-actions-append-only.sql"));
    PG.copyFileToContainer(org.testcontainers.images.builder.Transferable.of(script),"/tmp/check-audit-grants.sql");
    long before=count("admin_actions");
    var checked=PG.execInContainer("psql","-X","-U",PG.getUsername(),"-d",PG.getDatabaseName(),
        "-v","app_role="+role,"-f","/tmp/check-audit-grants.sql");
    assertThat(checked.getExitCode()).as(checked.getStdout()+checked.getStderr()).isEqualTo(expectedExit);
    assertThat(checked.getStdout()).contains("\"ready\":"+(expectedExit==0));
    assertThat(count("admin_actions")).isEqualTo(before);
    return checked.getStdout();
  }
  @Test void openApiPublishesSuccessfulAuditResponsesWithoutGenericItemCollision() throws Exception {
    var result=mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn();
    var api=json.readTree(result.getResponse().getContentAsString());
    var schemas=api.path("components").path("schemas");
    assertThat(schemas.path("AuditLogsResponse").path("properties").path("items").path("items").path("$ref").asText())
        .endsWith("/AdminAuditLogItem");
    assertThat(schemas.path("AdminAuditFilters").path("properties").path("admins").path("items").path("$ref").asText())
        .endsWith("/AdminAuditOperator");
    for (String path:java.util.List.of("/api/v1/admin/audit-logs","/api/v1/admin/audit-logs/filters")) {
      assertThat(api.path("paths").path(path).path("get").path("responses").has("200")).isTrue();
    }
  }
  private long add(long admin,String action,String at) {
    return jdbc.queryForObject("insert into admin_actions(admin_id,action,target_type,target_id,reason,created_at,updated_at) values (?,?,'USER',?,'사유',?,?) returning id",Long.class,
        admin,action,target.getId(),java.sql.Timestamp.from(Instant.parse(at)),java.sql.Timestamp.from(Instant.parse(at)));
  }
  private int count(String table) { return jdbc.queryForObject("select count(*) from "+table,Integer.class); }
  private User user(String login,UserType type) {
    User u=User.create(login,type);u.changeDisplayName(login);u.keepNotificationEmail(login+"@example.com");u=users.saveAndFlush(u);
    identities.saveAndFlush(AuthIdentity.github(u,"gh-"+u.getId(),login,login+"@example.com",now));return u;
  }
  private Cookie cookie(User u) { return new Cookie("linker_session",auth.issue(u,"test","127.0.0.1").rawToken()); }
  private Cookie verified(User u) {
    var issued=auth.issue(u,"test","127.0.0.1");auth.markOperatorVerified(issued.sessionId(),now);
    return new Cookie("linker_session",issued.rawToken());
  }
}
