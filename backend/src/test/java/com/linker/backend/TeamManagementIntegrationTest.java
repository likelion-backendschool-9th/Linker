package com.linker.backend;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.dto.team.request.CreateTeamRequest;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.subscription.Subscription;
import com.linker.backend.entity.subscription.type.*;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import com.linker.backend.repository.team.TeamRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.TeamSyncService;
import jakarta.servlet.http.Cookie;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Existing Flyway history only; no shared database or provider credentials. */
@SpringBootTest(properties = "spring.jpa.show-sql=false")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Testcontainers
class TeamManagementIntegrationTest {
  static final RsaMaterial KEYS = RsaMaterial.generate();
  @Container static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:16-alpine");
  @Container static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine")
      .withExposedPorts(6379);
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
    r.add("linker.issues.sync-enabled", () -> "false");
    r.add("linker.team-setup.worker-enabled", () -> "false");
  }
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired UserRepository users;
  @Autowired TeamRepository teams;
  @Autowired SubscriptionRepository subscriptions;
  @Autowired AuthService sessions;
  @Autowired PlatformTransactionManager transactions;
  @Autowired com.linker.backend.service.user.TeamManagementService management;
  @Autowired com.linker.backend.global.realtime.TeamChatAccess teamChat;
  @MockitoSpyBean Clock clock;
  @MockitoBean GithubTeamSource github;
  @MockitoBean TeamSyncService sync;
  User owner, admin, member, outsider, recruiter;
  long team, room, org, installation;
  String base;

  @BeforeEach
  void seed() {
    owner = user(UserType.DEVELOPER);
    admin = user(UserType.DEVELOPER);
    member = user(UserType.DEVELOPER);
    outsider = user(UserType.DEVELOPER);
    recruiter = user(UserType.RECRUITER);
    org = 100000 + owner.getId();
    installation = 200000 + owner.getId();
    var created = new TransactionTemplate(transactions).execute(status -> teams.create(owner.getId(),
        new GithubInstallationView(installation, org, "org-" + org, null),
        new CreateTeamRequest("" + installation, "기존 팀", "팀 소개"), Instant.now()));
    team = created.id();
    room = created.chatRoomId();
    join(admin, "ADMIN");
    join(member, "MEMBER");
    base = "/api/v1/user/teams/" + team;
  }

  @Test
  void settingsAndMembersExposeRolesAndRealFlexWithoutPrivateAccountData() throws Exception {
    mvc.perform(get(base + "/settings").cookie(cookie(member)))
        .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(jsonPath("$.myRole").value("MEMBER"))
        .andExpect(jsonPath("$.plan").value("FREE"))
        .andExpect(jsonPath("$.memberLimit").value(6))
        .andExpect(jsonPath("$.permissions.editInfo").value(false));
    var sub = subscriptions.saveAndFlush(Subscription.paid(SubscriptionPlan.FLEX, null, team,
        admin.getId(), BillingCycle.MONTHLY, 3, Instant.now().minusSeconds(1), Instant.now().plusSeconds(3600)));
    mvc.perform(get(base + "/settings").cookie(cookie(owner)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.plan").value("FLEX"))
        .andExpect(jsonPath("$.memberLimit").isEmpty())
        .andExpect(jsonPath("$.permissions.createInviteLink").value(false))
        .andExpect(jsonPath("$.permissions.transferOwnership").value(false))
        .andExpect(jsonPath("$.permissions.completeProject").value(false))
        .andExpect(jsonPath("$.billing.managerUserId").value(admin.getId()))
        .andExpect(jsonPath("$.billing.nextBillingAt").isEmpty());
    mvc.perform(get(base + "/members").cookie(cookie(admin)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(3))
        .andExpect(jsonPath("$.limit").isEmpty()).andExpect(jsonPath("$.items[0].email").doesNotExist());
    sub.endNow(Instant.now());
    subscriptions.saveAndFlush(sub);
    mvc.perform(get(base + "/members").cookie(cookie(owner)))
        .andExpect(jsonPath("$.count").value(3)).andExpect(jsonPath("$.limit").value(6));
  }

  @ParameterizedTest
  @ValueSource(strings = {"settings", "members"})
  void outsidersGuestsAndRecruitersCannotRead(String path) throws Exception {
    mvc.perform(get(base + "/" + path)).andExpect(status().isUnauthorized());
    mvc.perform(get(base + "/" + path).cookie(cookie(outsider))).andExpect(status().isForbidden());
    mvc.perform(get(base + "/" + path).cookie(cookie(recruiter)))
        .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("DEVELOPER_ONLY"));
  }

  @Test
  void adminEditsNameButMemberCannotAndBlankIsRejected() throws Exception {
    send(patch(base), member, "{\"name\":\"변조\"}").andExpect(status().isForbidden());
    send(patch(base), admin, "{\"name\":\"  새 팀  \",\"description\":\"새 소개\"}")
        .andExpect(status().isNoContent());
    assertThat(teams.findById(team).orElseThrow().getName()).isEqualTo("새 팀");
    send(patch(base), owner, "{\"name\":\"   \"}").andExpect(status().isBadRequest());
    assertThat(teams.findById(team).orElseThrow().getName()).isEqualTo("새 팀");
  }

  @Test
  void onlyOwnerChangesAdminAndMemberRolesAndOwnerChangesRequireTransfer() throws Exception {
    String path = base + "/members/" + member.getId() + "/role";
    send(patch(path), admin, "{\"role\":\"ADMIN\"}").andExpect(status().isForbidden());
    send(patch(path), owner, "{\"role\":\"ADMIN\"}").andExpect(status().isNoContent());
    assertThat(role(member)).isEqualTo("ADMIN");
    send(patch(path), owner, "{\"role\":\"OWNER\"}").andExpect(status().isConflict());
    send(patch(base + "/members/" + owner.getId() + "/role"), owner, "{\"role\":\"MEMBER\"}")
        .andExpect(status().isConflict());
    send(patch(path), owner, "{\"role\":\"MEMBER\"}").andExpect(status().isNoContent());
    assertThat(role(owner)).isEqualTo("OWNER");
    assertThat(role(member)).isEqualTo("MEMBER");
  }

  @Test
  void adminKicksOnlyMemberAndKeepsBothMembershipHistories() throws Exception {
    mvc.perform(delete(base + "/members/" + owner.getId()).cookie(cookie(admin)))
        .andExpect(status().isForbidden());
    mvc.perform(delete(base + "/members/" + admin.getId()).cookie(cookie(admin)))
        .andExpect(status().isForbidden());
    mvc.perform(delete(base + "/members/" + member.getId()).cookie(cookie(admin)))
        .andExpect(status().isNoContent());
    assertThat(jdbc.queryForObject("select leave_type from team_members where team_id=? and user_id=?",
        String.class, team, member.getId())).isEqualTo("KICKED");
    assertThat(jdbc.queryForObject("select left_at is not null from chat_room_members where room_id=? and user_id=?",
        Boolean.class, room, member.getId())).isTrue();
    assertThat(jdbc.queryForObject("select count(*) from team_members where team_id=?", Long.class, team)).isEqualTo(3);
    assertThat(jdbc.queryForObject("select count(*) from notifications where target_id=? and notification_type='TEAM_MEMBER_REMOVED'",
        Long.class, team)).isEqualTo(2);
    mvc.perform(get(base + "/members").cookie(cookie(member))).andExpect(status().isForbidden());
    verifyNoInteractions(github);
  }

  @Test
  void leavingOwnerIsRejectedAndNormalLeaveDoesNotDeleteHistory() throws Exception {
    mvc.perform(delete(base + "/members/me").cookie(cookie(owner))).andExpect(status().isConflict());
    mvc.perform(delete(base + "/members/me").cookie(cookie(member))).andExpect(status().isNoContent());
    assertThat(jdbc.queryForObject("select leave_type from team_members where team_id=? and user_id=?",
        String.class, team, member.getId())).isEqualTo("LEFT");
    assertThat(jdbc.queryForObject("select left_at is not null from chat_room_members where room_id=? and user_id=?",
        Boolean.class, room, member.getId())).isTrue();
  }

  @Test
  void readOnlySettingsAreReadableButMutationsAreRejectedBeforeGithub() throws Exception {
    jdbc.update("update teams set status='READ_ONLY' where id=?", team);
    mvc.perform(get(base + "/settings").cookie(cookie(owner)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.permissions.editInfo").value(false));
    send(patch(base), owner, "{\"name\":\"실패\"}").andExpect(status().isConflict());
    send(post(base + "/repos"), admin, "{\"repoId\":900}").andExpect(status().isConflict());
    mvc.perform(post(base + "/archive").cookie(cookie(owner))).andExpect(status().isConflict());
    verifyNoInteractions(github);
  }

  @Test
  void archiveIsOwnerOnlyAndKeepsChatRows() throws Exception {
    long message = jdbc.queryForObject("insert into chat_messages(room_id,sender_id,message_type,body,visibility,created_at,updated_at)"
        + " values (?,?,'TEXT','기록','VISIBLE',now(),now()) returning id", Long.class, room, member.getId());
    jdbc.update("update teams set status='COMPLETED' where id=?", team);
    assertThat(teamChat.writableBy(member.getId(), team)).isTrue();
    mvc.perform(post(base + "/archive").cookie(cookie(admin))).andExpect(status().isForbidden());
    mvc.perform(post(base + "/archive").cookie(cookie(owner))).andExpect(status().isNoContent());
    assertThat(teams.findById(team).orElseThrow().getStatus().name()).isEqualTo("ARCHIVED");
    assertThat(jdbc.queryForObject("select count(*) from chat_room_members where room_id=? and left_at is null",
        Long.class, room)).isEqualTo(3);
    mvc.perform(get(base + "/settings").cookie(cookie(owner))).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/user/chat-rooms/" + room).cookie(cookie(member)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.team.status").value("ARCHIVED"));
    assertThat(teamChat.writableBy(member.getId(), team)).isFalse();
    mvc.perform(get("/api/v1/user/chat-rooms/" + room + "/messages").cookie(cookie(member)))
        .andExpect(status().isOk());
    send(patch("/api/v1/user/chat-rooms/" + room + "/messages/" + message), member, "{\"text\":\"변경\"}")
        .andExpect(status().isForbidden());
    mvc.perform(delete("/api/v1/user/chat-rooms/" + room + "/messages/" + message).cookie(cookie(owner)))
        .andExpect(status().isForbidden());
    send(post("/api/v1/user/chat-rooms/" + room + "/share-cards"), member,
        "{\"targetType\":\"PROFILE\",\"targetId\":" + owner.getId() + ",\"clientMessageId\":\"" + UUID.randomUUID() + "\"}")
        .andExpect(status().isForbidden());
  }

  @Test
  void repositoryAddChecksLiveAccessOutsideTransactionAndDisconnectKeepsCache() throws Exception {
    long githubId = 300000 + team;
    when(github.repositories(anyLong(), eq(installation), eq(org))).thenAnswer(invocation -> {
      assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
      return List.of(new GithubTeamSource.Repository(githubId, "org-" + org, "repo", "org-" + org + "/repo",
          null, null, 0, 0, "https://github.com/org/repo", true, false, null, "main"));
    });
    send(post(base + "/repos"), member, "{\"repoId\":" + githubId + "}")
        .andExpect(status().isForbidden());
    send(post(base + "/repos"), admin, "{\"repoId\":" + githubId + "}")
        .andExpect(status().isNoContent());
    send(post(base + "/repos"), admin, "{\"repoId\":" + githubId + "}")
        .andExpect(status().isNoContent());
    long repo = jdbc.queryForObject("select repo_id from team_repos where team_id=?", Long.class, team);
    send(post(base + "/repos"), owner, "{\"repoId\":1}").andExpect(status().isForbidden());
    mvc.perform(delete(base + "/repos/" + repo).cookie(cookie(admin))).andExpect(status().isNoContent());
    assertThat(jdbc.queryForObject("select count(*) from team_repos where team_id=?", Long.class, team)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from github_repos where id=?", Long.class, repo)).isEqualTo(1);
    verify(sync, times(3)).invalidate(team);
  }

  @Test
  void removedPermissionDuringGithubReadIsRecheckedAndNoLinkIsSaved() throws Exception {
    when(github.repositories(anyLong(), eq(installation), eq(org))).thenAnswer(invocation -> {
      assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
      jdbc.update("update team_members set role='MEMBER' where team_id=? and user_id=?", team, admin.getId());
      return List.of(new GithubTeamSource.Repository(900, "org", "repo", "org/repo", null,
          null, 0, 0, null, false, false, null, "main"));
    });
    send(post(base + "/repos"), admin, "{\"repoId\":900}").andExpect(status().isForbidden());
    assertThat(jdbc.queryForObject("select count(*) from team_repos where team_id=?", Long.class, team)).isZero();
  }

  @Test
  @Transactional
  void preparationSqlDoesNotChooseOrModifyFlywayVersion() {
    assertThat(jdbc.queryForObject("select to_regclass('team_invite_links')", String.class)).isNull();
    new ResourceDatabasePopulator(new ClassPathResource("db/team-schema/09-team-settings.sql"))
        .execute(jdbc.getDataSource());
    assertThat(jdbc.queryForObject("select max(version::int) from flyway_schema_history", Integer.class)).isEqualTo(25);
    for (String table : List.of("team_invite_links", "github_org_invitations", "team_ownership_transfers",
        "team_completions", "completion_records"))
      assertThat(jdbc.queryForObject("select to_regclass(?) is not null", Boolean.class, table)).isTrue();
  }

  @Test
  void deletionRequiresOwnerAndExactNameThenPurgesOnlyDueTeamChat() throws Exception {
    long message = jdbc.queryForObject("insert into chat_messages(room_id,sender_id,message_type,body,visibility,created_at,updated_at)"
        + " values (?,?,'TEXT','보존된 대화','VISIBLE',now(),now()) returning id", Long.class, room, member.getId());
    long file = jdbc.queryForObject("insert into uploaded_files(uploader_id,purpose,storage_key,content_type,byte_size,created_at,updated_at)"
        + " values (?,'CHAT',?,'image/png',10,now(),now()) returning id", Long.class, member.getId(), "chat/" + team);
    jdbc.update("insert into chat_message_images(message_id,file_id,sort_order,created_at,updated_at) values (?,?,0,now(),now())", message, file);
    jdbc.update("insert into chat_message_mentions(message_id,mentioned_user_id,mention_all,created_at,updated_at) values (?,?,false,now(),now())", message, owner.getId());
    jdbc.update("update chat_rooms set last_message_id=? where id=?", message, room);
    jdbc.update("update chat_room_members set last_read_message_id=? where room_id=?", message, room);
    send(delete(base), admin, "{\"confirmName\":\"기존 팀\"}").andExpect(status().isForbidden());
    send(delete(base), owner, "{\"confirmName\":\"다른 이름\"}").andExpect(status().isBadRequest());
    assertThat(teams.findById(team).orElseThrow().getStatus().name()).isEqualTo("ACTIVE");
    send(delete(base), owner, "{\"confirmName\":\"기존 팀\"}").andExpect(status().isNoContent());
    var deleted = teams.findById(team).orElseThrow();
    assertThat(deleted.getStatus().name()).isEqualTo("DELETED");
    assertThat(deleted.getDeleteScheduledAt()).isBetween(Instant.now().plusSeconds(30 * 86400L - 10), Instant.now().plusSeconds(30 * 86400L + 10));
    assertThat(jdbc.queryForObject("select count(*) from team_members where team_id=? and left_at is null", Long.class, team)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from notifications where target_id=? and notification_type='TEAM_DELETED'", Long.class, team)).isEqualTo(3);
    doReturn(deleted.getDeleteScheduledAt().minusNanos(1000)).when(clock).instant();
    management.purgeDeletedChats();
    assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, room)).isEqualTo(1);
    doReturn(deleted.getDeleteScheduledAt()).when(clock).instant();
    management.purgeDeletedChats();
    management.purgeDeletedChats();
    assertThat(jdbc.queryForObject("select count(*) from chat_rooms where id=?", Long.class, room)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from chat_messages where id=?", Long.class, message)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from chat_message_images where message_id=?", Long.class, message)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from chat_message_mentions where message_id=?", Long.class, message)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from uploaded_files where id=?", Long.class, file)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from team_members where team_id=?", Long.class, team)).isEqualTo(3);
    verifyNoInteractions(github);
  }

  private User user(UserType type) {
    var user = User.create("p09-" + UUID.randomUUID().toString().substring(0, 12), type);
    user.completeOnboarding(Instant.now());
    return users.saveAndFlush(user);
  }
  @Test
  void temporaryOwnerSuspensionDelegatesOnlyWhileThePeriodIsOpen() throws Exception {
    owner.suspendUntil(Instant.now().plusSeconds(3600)); users.saveAndFlush(owner);
    mvc.perform(get(base+"/settings").cookie(cookie(owner))).andExpect(status().isOk())
        .andExpect(jsonPath("$.permissions.editInfo").value(false));
    mvc.perform(get(base+"/settings").cookie(cookie(admin))).andExpect(status().isOk())
        .andExpect(jsonPath("$.permissions.archive").value(true));
    mvc.perform(post(base+"/archive").cookie(cookie(admin))).andExpect(status().isNoContent());
  }
  @Test
  void permanentOwnerSuspensionDoesNotSilentlyTransferOwnership() throws Exception {
    owner.suspendUntil(null);users.saveAndFlush(owner);
    mvc.perform(post(base+"/archive").cookie(cookie(admin))).andExpect(status().isForbidden());
  }
  private Cookie cookie(User user) {
    return new Cookie("linker_session", sessions.issue(user, "p09-test", "127.0.0.1").rawToken());
  }
  private void join(User user, String role) {
    jdbc.update("insert into team_members(team_id,user_id,role,github_org_state,joined_at,created_at,updated_at)"
        + " values (?,?,?,'MEMBER',now(),now(),now())", team, user.getId(), role);
    jdbc.update("insert into chat_room_members(room_id,user_id,muted,joined_at,created_at,updated_at)"
        + " values (?,?,false,now(),now(),now())", room, user.getId());
  }
  private String role(User user) {
    return jdbc.queryForObject("select role from team_members where team_id=? and user_id=? and left_at is null",
        String.class, team, user.getId());
  }
  private org.springframework.test.web.servlet.ResultActions send(MockHttpServletRequestBuilder request,
      User user, String body) throws Exception {
    return mvc.perform(request.cookie(cookie(user)).contentType(MediaType.APPLICATION_JSON).content(body));
  }
}
