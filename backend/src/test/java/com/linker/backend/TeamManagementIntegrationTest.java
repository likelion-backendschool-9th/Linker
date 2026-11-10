package com.linker.backend;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.containsString;
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
  @Autowired com.linker.backend.repository.account.AuthIdentityRepository identities;
  @Autowired com.linker.backend.service.user.TeamInvitationService invitations;
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
  void finalAccountDeletionClosesTeamAndChatTogetherButWithdrawingKeepsBoth() {
    var accounts=new TransactionTemplate(transactions);
    accounts.executeWithoutResult(tx -> {var user=users.findById(member.getId()).orElseThrow();user.markWithdrawing(Instant.now());users.saveAndFlush(user);});
    assertThat(jdbc.queryForObject("select count(*) from team_members where team_id=? and user_id=? and left_at is null",Long.class,team,member.getId())).isEqualTo(1);
    accounts.executeWithoutResult(tx -> {var user=users.findById(member.getId()).orElseThrow();user.anonymize(Instant.now());management.closeDeletedAccountMemberships(user,Instant.now());});
    assertThat(jdbc.queryForObject("select count(*) from team_members where team_id=? and user_id=? and left_at is null",Long.class,team,member.getId())).isZero();
    assertThat(jdbc.queryForObject("select count(*) from chat_room_members where room_id=? and user_id=? and left_at is null",Long.class,room,member.getId())).isZero();
  }

  @Test
  void ownershipRequiresRecipientAndChangesRolesOnlyAfterAcceptance() throws Exception {
    send(post(base+"/ownership-transfers"),admin,"{\"toUserId\":"+member.getId()+"}").andExpect(status().isForbidden());
    String body=send(post(base+"/ownership-transfers"),owner,"{\"toUserId\":"+member.getId()+"}")
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    long id=new tools.jackson.databind.ObjectMapper().readTree(body).path("transferId").asLong();
    assertThat(jdbc.queryForObject("select role from team_members where team_id=? and user_id=? and left_at is null",String.class,team,owner.getId())).isEqualTo("OWNER");
    mvc.perform(post(base+"/ownership-transfers/"+id+"/accept").cookie(cookie(admin))).andExpect(status().isForbidden());
    mvc.perform(get(base+"/settings").cookie(cookie(member))).andExpect(jsonPath("$.ownershipTransfer.isRecipient").value(true));
    mvc.perform(post(base+"/ownership-transfers/"+id+"/accept").cookie(cookie(member))).andExpect(status().isNoContent());
    assertThat(jdbc.queryForObject("select role from team_members where team_id=? and user_id=? and left_at is null",String.class,team,owner.getId())).isEqualTo("ADMIN");
    assertThat(jdbc.queryForObject("select role from team_members where team_id=? and user_id=? and left_at is null",String.class,team,member.getId())).isEqualTo("OWNER");
    mvc.perform(post(base+"/ownership-transfers/"+id+"/accept").cookie(cookie(member))).andExpect(status().isConflict());
  }

  @Test
  void completionUsesLastJoinAndRetainsFourteenDayThresholdAndSevenDayUndoWindow() throws Exception {
    Instant now=Instant.parse("2026-11-11T00:00:00Z");doReturn(now).when(clock).instant();
    jdbc.update("update team_members set joined_at=? where team_id=? and user_id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(14))),team,owner.getId());
    jdbc.update("update team_members set joined_at=? where team_id=? and user_id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(14)).plusSeconds(1)),team,admin.getId());
    jdbc.update("update team_members set joined_at=? where team_id=? and user_id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(7))),team,member.getId());
    jdbc.update("insert into team_members(team_id,user_id,role,github_org_state,joined_at,left_at,leave_type,created_at,updated_at) values(?,?,'MEMBER','MEMBER',?,?,'LEFT',now(),now())",team,member.getId(),java.sql.Timestamp.from(now.minus(Duration.ofDays(60))),java.sql.Timestamp.from(now.minus(Duration.ofDays(20))));
    mvc.perform(post(base+"/completion").cookie(cookie(member))).andExpect(status().isForbidden());
    mvc.perform(post(base+"/completion").cookie(cookie(admin))).andExpect(status().isNoContent());
    mvc.perform(post(base+"/completion").cookie(cookie(owner))).andExpect(status().isConflict());
    assertThat(jdbc.queryForObject("select count(*) from completion_records where completion_id in (select id from team_completions where team_id="+team+")",Long.class)).isZero();
    doReturn(now.plus(Duration.ofDays(7)).minusSeconds(1)).when(clock).instant();
    management.finalizeCompletions();
    assertThat(jdbc.queryForObject("select count(*) from completion_records where completion_id in (select id from team_completions where team_id="+team+")",Long.class)).isZero();
    doReturn(now.plus(Duration.ofDays(7))).when(clock).instant();
    mvc.perform(delete(base+"/completion").cookie(cookie(owner))).andExpect(status().isConflict());
    management.finalizeCompletions();management.finalizeCompletions();
    assertThat(jdbc.queryForObject("select count(*) from completion_records where user_id=?",Long.class,owner.getId())).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from completion_records where user_id in (?,?)",Long.class,admin.getId(),member.getId())).isZero();
    doCallRealMethod().when(clock).instant();
  }

  @Test
  void undoRemovesPendingCompletionAndAllowsCompletingAgain() throws Exception {
    mvc.perform(post(base+"/completion").cookie(cookie(owner))).andExpect(status().isNoContent());
    mvc.perform(delete(base+"/completion").cookie(cookie(admin))).andExpect(status().isNoContent());
    assertThat(teams.findById(team).orElseThrow().getStatus().name()).isEqualTo("ACTIVE");
    mvc.perform(post(base+"/completion").cookie(cookie(owner))).andExpect(status().isNoContent());
  }

  @Test
  void aiSwitchIsOwnerOnlyAndOmittedFieldKeepsExistingValue() throws Exception {
    send(patch(base),admin,"{\"name\":\"팀\",\"aiSummaryEnabled\":false}").andExpect(status().isForbidden());
    send(patch(base),owner,"{\"name\":\"팀\",\"aiSummaryEnabled\":false}").andExpect(status().isNoContent());
    send(patch(base),admin,"{\"name\":\"새 팀\"}").andExpect(status().isNoContent());
    assertThat(teams.findById(team).orElseThrow().isAiSummaryEnabled()).isFalse();
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
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.plan").value("FLEX"))
        .andExpect(jsonPath("$.memberLimit").isEmpty())
        .andExpect(jsonPath("$.permissions.createInviteLink").value(true))
        .andExpect(jsonPath("$.permissions.transferOwnership").value(true))
        .andExpect(jsonPath("$.permissions.completeProject").value(true))
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
  void delegatedAdminCanRemoveOtherAdminsOnlyDuringTemporaryOwnerSuspension() throws Exception {
    var otherAdmin = user(UserType.DEVELOPER);
    join(otherAdmin, "ADMIN");
    owner.suspendUntil(clock.instant().plusSeconds(3600));
    users.saveAndFlush(owner);
    mvc.perform(get(base + "/settings").cookie(cookie(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.permissions.changeRoles").value(true))
        .andExpect(jsonPath("$.permissions.deleteTeam").value(true));
    mvc.perform(delete(base + "/members/" + owner.getId()).cookie(cookie(admin)))
        .andExpect(status().isForbidden());
    mvc.perform(delete(base + "/members/" + admin.getId()).cookie(cookie(admin)))
        .andExpect(status().isForbidden());
    mvc.perform(delete(base + "/members/" + otherAdmin.getId()).cookie(cookie(admin)))
        .andExpect(status().isNoContent());
    assertThat(jdbc.queryForObject(
        "select leave_type from team_members where team_id=? and user_id=?",
        String.class, team, otherAdmin.getId())).isEqualTo("KICKED");
    assertThat(jdbc.queryForObject(
        "select left_at is not null from chat_room_members where room_id=? and user_id=?",
        Boolean.class, room, otherAdmin.getId())).isTrue();
    verifyNoInteractions(github);
  }

  @Test
  void expiredOrPermanentOwnerSuspensionDoesNotGrantAdminRemovalAuthority() throws Exception {
    var otherAdmin = user(UserType.DEVELOPER);
    join(otherAdmin, "ADMIN");
    for (Instant until : java.util.Arrays.asList(clock.instant().minusSeconds(1), null)) {
      owner.suspendUntil(until);
      users.saveAndFlush(owner);
      mvc.perform(get(base + "/settings").cookie(cookie(admin)))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.permissions.changeRoles").value(false));
      mvc.perform(delete(base + "/members/" + otherAdmin.getId()).cookie(cookie(admin)))
          .andExpect(status().isForbidden());
    }
    assertThat(role(otherAdmin)).isEqualTo("ADMIN");
  }

  @Test
  void ownerCanManuallyCloseADeletedMembersTeamAndChatPeriodsWithoutErasingHistory() throws Exception {
    member.anonymize(clock.instant());
    users.saveAndFlush(member);
    mvc.perform(get(base + "/members").cookie(cookie(owner)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(3))
        .andExpect(content().string(containsString("탈퇴한 사용자")));
    mvc.perform(delete(base + "/members/" + member.getId()).cookie(cookie(owner)))
        .andExpect(status().isNoContent());
    mvc.perform(get(base + "/members").cookie(cookie(owner)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(2));
    assertThat(jdbc.queryForObject("select count(*) from team_members where team_id=?",
        Long.class, team)).isEqualTo(3);
    assertThat(jdbc.queryForObject(
        "select left_at is not null from chat_room_members where room_id=? and user_id=?",
        Boolean.class, room, member.getId())).isTrue();
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
  void agreedOwnershipCompletionMigrationIsApplied() {
    assertThat(jdbc.queryForObject("select to_regclass('team_invite_links')", String.class))
        .isNotNull();
    assertThat(
            jdbc.queryForObject(
                "select max(version::int) from flyway_schema_history", Integer.class))
        .isEqualTo(29);
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

  @Test
  void teamChatAccessReadsCurrentMembersOfLiveTeamsThroughJpa() {
    jdbc.update("update users set display_name='관리자' where id=?", admin.getId());
    jdbc.update("update users set display_name='' where id=?", member.getId());
    join(outsider, "MEMBER");
    jdbc.update("update team_members set left_at=now(), leave_type='LEFT' where team_id=? and user_id=?",
        team, outsider.getId());
    User withdrawing = user(UserType.DEVELOPER);
    join(withdrawing, "MEMBER");
    jdbc.update("update users set status='WITHDRAWING' where id=?", withdrawing.getId());

    var view = teamChat.readableBy(admin.getId(), team);
    assertThat(view).isNotNull();
    assertThat(view.name()).isEqualTo("기존 팀");
    assertThat(view.status()).isEqualTo("ACTIVE");
    assertThat(view.role()).isEqualTo("ADMIN");
    assertThat(teamChat.canModerate(admin.getId(), team)).isTrue();
    assertThat(teamChat.canModerate(member.getId(), team)).isFalse();
    assertThat(teamChat.readableBy(outsider.getId(), team)).isNull();

    var candidates = teamChat.mentionCandidates(member.getId(), team);
    var expected = java.util.stream.Stream.of(owner, admin, member)
        .sorted(java.util.Comparator.comparing((User u) -> u.getUsername().toLowerCase()).thenComparing(User::getId))
        .map(User::getId).toList();
    assertThat(candidates).extracting(c -> c.id()).containsExactlyElementsOf(expected);
    assertThat(candidates).filteredOn(c -> c.id() == admin.getId()).extracting(c -> c.name())
        .containsExactly("관리자");
    assertThat(candidates).filteredOn(c -> c.id() == member.getId()).extracting(c -> c.name())
        .containsExactly(member.getUsername());
    assertThat(teamChat.mentionCandidates(outsider.getId(), team)).isEmpty();

    jdbc.update("update teams set status='DELETED' where id=?", team);
    assertThat(teamChat.readableBy(owner.getId(), team)).isNull();
    assertThat(teamChat.mentionCandidates(owner.getId(), team)).isEmpty();
  }

  @Test
  void inviteCreationReturnsCodeOnceAndStoresOnlyItsHash() throws Exception {
    var link = createInvite(admin);
    String code = link.path("code").asString();
    assertThat(code).matches("[A-Za-z0-9_-]{43}");
    assertThat(
            jdbc.queryForObject(
                "select token_hash from team_invite_links where id=?",
                String.class,
                link.path("id").asLong()))
        .hasSize(64)
        .isNotEqualTo(code);
    mvc.perform(get(base + "/invite-links").cookie(cookie(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value(link.path("id").asLong()))
        .andExpect(jsonPath("$.items[0].code").doesNotExist());
    mvc.perform(get("/api/v1/public/invites/" + code))
        .andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(jsonPath("$.status").value("VALID"))
        .andExpect(jsonPath("$.team.name").doesNotExist());
    mvc.perform(delete(base + "/invite-links/" + link.path("id").asLong()).cookie(cookie(admin)))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/public/invites/" + code))
        .andExpect(jsonPath("$.status").value("REVOKED"));
    send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
        .andExpect(status().isGone());
  }

  @Test
  void inviteNotifyValidatesCodeAndDeveloperThenCreatesOneReusableNotification() throws Exception {
    var link = createInvite(owner);
    long id = link.path("id").asLong();
    String code = link.path("code").asString();
    send(
            post(base + "/invite-links/" + id + "/notify"),
            admin,
            "{\"handle\":\"@" + outsider.getUsername() + "\",\"code\":\"wrong\"}")
        .andExpect(status().isNotFound());
    String body =
        "{\"handle\":\"@" + outsider.getUsername().toUpperCase() + "\",\"code\":\"" + code + "\"}";
    send(post(base + "/invite-links/" + id + "/notify"), admin, body)
        .andExpect(status().isNoContent());
    send(post(base + "/invite-links/" + id + "/notify"), admin, body)
        .andExpect(status().isNoContent());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from notifications where user_id=? and notification_type='TEAM_INVITE' and link_path=?",
                Long.class,
                outsider.getId(),
                "/invite/" + code))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "select payload->>'title' from notifications where user_id=? and notification_type='TEAM_INVITE' and link_path=?",
                String.class,
                outsider.getId(),
                "/invite/" + code))
        .contains("기존 팀");
  }

  @Test
  void acceptingInviteJoinsTeamAndChatAtomicallyAndRepeatedAcceptDoesNotDuplicate()
      throws Exception {
    var link = createInvite(owner);
    String code = link.path("code").asString();
    send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.teamId").value(team));
    assertThat(
            jdbc.queryForObject(
                "select count(*) from team_members where team_id=? and user_id=? and left_at is null",
                Long.class,
                team,
                outsider.getId()))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from chat_room_members where room_id=? and user_id=? and left_at is null",
                Long.class,
                room,
                outsider.getId()))
        .isEqualTo(1);
    send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("ALREADY_MEMBER"));
    mvc.perform(get("/api/v1/public/invites/" + code).cookie(cookie(outsider)))
        .andExpect(jsonPath("$.participation.state").value("ALREADY_MEMBER"));
  }

  @Test
  void expiredReadOnlyAndArchivedTeamsCannotAcceptInvites() throws Exception {
    var link = createInvite(owner);
    String code = link.path("code").asString();
    jdbc.update(
        "update team_invite_links set expires_at=now() where id=?", link.path("id").asLong());
    send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
        .andExpect(status().isGone());
    jdbc.update(
        "update team_invite_links set expires_at=now()+interval '1 day' where id=?",
        link.path("id").asLong());
    for (String state : List.of("READ_ONLY", "ARCHIVED", "DELETED")) {
      jdbc.update("update teams set status=? where id=?", state, team);
      send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
          .andExpect(status().isConflict());
    }
    assertThat(
            jdbc.queryForObject(
                "select count(*) from team_members where team_id=? and user_id=?",
                Long.class,
                team,
                outsider.getId()))
        .isZero();
  }

  @Test
  void inviteManagementCannotBeUsedByGuestsRecruitersMembersOrDifferentTeams() throws Exception {
    mvc.perform(post(base + "/invite-links")).andExpect(status().isUnauthorized());
    send(post(base + "/invite-links"), recruiter, "{}").andExpect(status().isForbidden());
    send(post(base + "/invite-links"), member, "{}").andExpect(status().isForbidden());
    send(post(base + "/invite-links"), outsider, "{}").andExpect(status().isForbidden());
    var link = createInvite(owner);
    send(post("/api/v1/user/invites/" + link.path("code").asString() + "/accept"), recruiter, "{}")
        .andExpect(status().isForbidden());
    var unknown = "/api/v1/user/teams/999999999/invite-links/" + link.path("id").asLong();
    mvc.perform(delete(unknown).cookie(cookie(owner))).andExpect(status().isForbidden());
  }

  @Test
  void inviteAcceptanceEnforcesFreeLimitAndUsesExistingFlexBenefit() throws Exception {
    for (int i = 0; i < 3; i++) join(user(UserType.DEVELOPER), "MEMBER");
    String code = createInvite(owner).path("code").asString();
    send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("TEAM_MEMBER_LIMIT"));
    subscriptions.saveAndFlush(
        Subscription.paid(
            SubscriptionPlan.FLEX,
            null,
            team,
            owner.getId(),
            BillingCycle.MONTHLY,
            6,
            Instant.now().minusSeconds(1),
            Instant.now().plusSeconds(3600)));
    send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
        .andExpect(status().isOk());
  }

  @Test
  void simultaneousInvitesCannotConsumeTheSameLastFreeSeatTwice() throws Exception {
    join(user(UserType.DEVELOPER), "MEMBER");
    join(user(UserType.DEVELOPER), "MEMBER");
    String code = createInvite(owner).path("code").asString();
    var second = user(UserType.DEVELOPER);
    var start = new java.util.concurrent.CountDownLatch(1);
    var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
    try {
      var calls =
          java.util.stream.Stream.of(outsider, second)
              .map(target ->
                  pool.submit(() -> {
                    start.await();
                    try {
                      invitations.accept(principal(target), code);
                      return "OK";
                    } catch (com.linker.backend.global.error.ApiException failure) {
                      return failure.getCode();
                    }
                  }))
              .toList();
      start.countDown();
      assertThat(List.of(calls.get(0).get(), calls.get(1).get()))
          .containsExactlyInAnyOrder("OK", "TEAM_MEMBER_LIMIT");
      assertThat(
              jdbc.queryForObject(
                  "select count(*) from team_members where team_id=? and left_at is null",
                  Long.class,
                  team))
          .isEqualTo(6);
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void failedChatAdmissionRollsBackTeamMembership() throws Exception {
    String code = createInvite(owner).path("code").asString();
    jdbc.update("delete from chat_room_members where room_id=?", room);
    jdbc.update("delete from chat_rooms where id=?", room);
    send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
        .andExpect(status().isConflict());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from team_members where team_id=? and user_id=?",
                Long.class,
                team,
                outsider.getId()))
        .isZero();
  }

  @Test
  void githubInvitationRequiresBothOwnersAndNeverCallsGitHubInsideTransaction() throws Exception {
    jdbc.update(
        "update team_members set github_org_state='NOT_MEMBER' where team_id=? and user_id=?",
        team,
        member.getId());
    when(github.organizationOwner(eq(owner.getId()), eq(org), anyString()))
        .thenAnswer(call -> {
          assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
          return true;
        });
    when(github.organizationMemberState(
            eq(owner.getId()), eq(org), anyString(), anyString(), anyLong()))
        .thenReturn("NONE", "PENDING");
    when(github.inviteOrganizationMember(eq(owner.getId()), eq(org), anyString(), anyLong()))
        .thenAnswer(call -> {
          assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
          return 987L;
        });
    String path = base + "/members/" + member.getId() + "/github-invitation";
    send(post(path), admin, "{}").andExpect(status().isForbidden());
    send(post(path), owner, "{}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PENDING"));
    send(post(path), owner, "{}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sent").value(false));
    verify(github, times(1))
        .inviteOrganizationMember(eq(owner.getId()), eq(org), anyString(), anyLong());
    assertThat(
            jdbc.queryForObject(
                "select github_org_state from team_members where team_id=? and user_id=? and left_at is null",
                String.class,
                team,
                member.getId()))
        .isEqualTo("INVITED");
    assertThat(
            jdbc.queryForObject(
                "select status from github_org_invitations where team_id=? and invitee_user_id=?",
                String.class,
                team,
                member.getId()))
        .isEqualTo("PENDING");
  }

  @Test
  void githubOwnerCheckFailureDoesNotHideSettingsOrPretendAnInvitationWasSent() throws Exception {
    when(github.organizationOwner(eq(owner.getId()), eq(org), anyString()))
        .thenThrow(
            new com.linker.backend.global.error.ApiException(
                503, "SERVICE_UNAVAILABLE", "연결 확인 필요"));
    mvc.perform(get(base + "/settings").cookie(cookie(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.githubOrgOwner").value(false))
        .andExpect(jsonPath("$.githubInvitationBlockedReason").value("연결 확인 필요"));
    send(post(base + "/members/" + member.getId() + "/github-invitation"), owner, "{}")
        .andExpect(status().isServiceUnavailable());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from github_org_invitations where team_id=?", Long.class, team))
        .isZero();
  }

  @Test
  void githubRateLimitIsRecordedAsFailureRatherThanMembership() throws Exception {
    jdbc.update(
        "update team_members set github_org_state='NOT_MEMBER' where team_id=? and user_id=?",
        team,
        member.getId());
    when(github.organizationOwner(anyLong(), anyLong(), anyString())).thenReturn(true);
    when(github.organizationMemberState(anyLong(), anyLong(), anyString(), anyString(), anyLong()))
        .thenReturn("NONE");
    when(github.inviteOrganizationMember(anyLong(), anyLong(), anyString(), anyLong()))
        .thenThrow(
            new com.linker.backend.global.error.ApiException(429, "GITHUB_INVITE_LIMIT", "초대 한도"));
    send(post(base + "/members/" + member.getId() + "/github-invitation"), owner, "{}")
        .andExpect(status().isTooManyRequests());
    assertThat(
            jdbc.queryForObject(
                "select status from github_org_invitations where team_id=?", String.class, team))
        .isEqualTo("FAILED");
    assertThat(
            jdbc.queryForObject(
                "select github_org_state from team_members where team_id=? and user_id=? and left_at is null",
                String.class,
                team,
                member.getId()))
        .isEqualTo("NOT_MEMBER");
  }

  @Test
  void personalMembershipCapCountsCurrentTeamsButNotArchivedTeams() throws Exception {
    long archivedCandidate = 0;
    for (int index = 0; index < 10; index++)
      archivedCandidate = createExtraTeam(outsider, 1000 + index);
    String code = createInvite(owner).path("code").asString();
    send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("TEAM_COUNT_LIMIT"));
    final long archive = archivedCandidate;
    new TransactionTemplate(transactions)
        .executeWithoutResult(
            status -> teams.lockTeamForSetup(archive).orElseThrow().archive(Instant.now()));
    send(post("/api/v1/user/invites/" + code + "/accept"), outsider, "{}")
        .andExpect(status().isOk());
  }

  @Test
  void rejoiningWithNewInvitePreservesMembershipHistoryAndReusesChatMembership() throws Exception {
    String code = createInvite(owner).path("code").asString();
    mvc.perform(delete(base + "/members/me").cookie(cookie(member)))
        .andExpect(status().isNoContent());
    send(post("/api/v1/user/invites/" + code + "/accept"), member, "{}").andExpect(status().isOk());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from team_members where team_id=? and user_id=?",
                Long.class,
                team,
                member.getId()))
        .isEqualTo(2);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from team_members where team_id=? and user_id=? and left_at is null",
                Long.class,
                team,
                member.getId()))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from chat_room_members where room_id=? and user_id=? and left_at is null",
                Long.class,
                room,
                member.getId()))
        .isEqualTo(1);
  }

  @Test
  void simultaneousInvitesAcrossDifferentTeamsRespectOnePersonalLimit() throws Exception {
    for (int index = 0; index < 9; index++) createExtraTeam(outsider, 2000 + index);
    long another = createExtraTeam(owner, 3000);
    String first = createInvite(owner).path("code").asString();
    String second = invitations.create(principal(owner), another).code();
    var start = new java.util.concurrent.CountDownLatch(1);
    var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
    try {
      var calls =
          java.util.stream.Stream.of(first, second)
              .map(code ->
                  pool.submit(() -> {
                    start.await();
                    try {
                      invitations.accept(principal(outsider), code);
                      return "OK";
                    } catch (com.linker.backend.global.error.ApiException failure) {
                      return failure.getCode();
                    }
                  }))
              .toList();
      start.countDown();
      assertThat(List.of(calls.get(0).get(), calls.get(1).get()))
          .containsExactlyInAnyOrder("OK", "TEAM_COUNT_LIMIT");
      assertThat(teams.countedTeams(outsider.getId())).isEqualTo(10);
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void uncertainGithubDeliveryIsReconciledBeforeRetryAndWebhookConfirmationClosesThePendingRow()
      throws Exception {
    jdbc.update(
        "update team_members set github_org_state='NOT_MEMBER' where team_id=? and user_id=?",
        team,
        member.getId());
    when(github.organizationOwner(anyLong(), anyLong(), anyString())).thenReturn(true);
    when(github.organizationMemberState(anyLong(), anyLong(), anyString(), anyString(), anyLong()))
        .thenReturn("NONE", "PENDING");
    when(github.inviteOrganizationMember(anyLong(), anyLong(), anyString(), anyLong()))
        .thenThrow(
            new com.linker.backend.global.error.ApiException(503, "SERVICE_UNAVAILABLE", "응답 미확인"));
    String path = base + "/members/" + member.getId() + "/github-invitation";
    send(post(path), owner, "{}").andExpect(status().isServiceUnavailable());
    send(post(path), owner, "{}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PENDING"));
    verify(github, times(1)).inviteOrganizationMember(anyLong(), anyLong(), anyString(), anyLong());
    assertThat(
            jdbc.queryForObject(
                "select status from github_org_invitations where team_id=?", String.class, team))
        .isEqualTo("PENDING");
    new TransactionTemplate(transactions)
        .executeWithoutResult(status -> teams.confirmMember(team, member.getId(), Instant.now()));
    assertThat(
            jdbc.queryForObject(
                "select status from github_org_invitations where team_id=?", String.class, team))
        .isEqualTo("ACCEPTED");
  }

  @Test
  void administratorCanListRepositoriesForSettingsButCannotWriteInitialSetup() throws Exception {
    when(github.repositories(eq(admin.getId()), eq(installation), eq(org)))
        .thenReturn(
            List.of(
                new GithubTeamSource.Repository(
                    900,
                    "org",
                    "repo",
                    "org/repo",
                    null,
                    null,
                    0,
                    0,
                    null,
                    false,
                    false,
                    null,
                    "main")));
    mvc.perform(get(base + "/setup/repos").cookie(cookie(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value(900));
    send(put(base + "/setup/repos"), admin, "{\"repoIds\":[900]}")
        .andExpect(status().isForbidden());
    mvc.perform(get(base + "/setup/repos").cookie(cookie(member)))
        .andExpect(status().isForbidden());
  }

  private long createExtraTeam(User creator, int offset) {
    return new TransactionTemplate(transactions)
        .execute(status ->
            teams.create(
                creator.getId(),
                new GithubInstallationView(
                    installation + offset, org + offset, "cap-org-" + (org + offset), null),
                new CreateTeamRequest(Long.toString(installation + offset), "추가 팀", "소개"),
                Instant.now()))
        .id();
  }

  private tools.jackson.databind.JsonNode createInvite(User creator) throws Exception {
    return tools.jackson.databind.json.JsonMapper.builder()
        .build()
        .readTree(
            send(post(base + "/invite-links"), creator, "{}")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());
  }

  private com.linker.backend.global.security.AuthenticatedUser principal(User user) {
    return new com.linker.backend.global.security.AuthenticatedUser(
        user.getId(),
        user.getUsername(),
        user.getUserType(),
        user.getStatus(),
        null,
        false,
        false,
        true,
        0);
  }

  private User user(UserType type) {
    var user = User.create("p09-" + UUID.randomUUID().toString().substring(0, 12), type);
    user.completeOnboarding(Instant.now());
    var saved = users.saveAndFlush(user);
    if (type == UserType.DEVELOPER)
      identities.saveAndFlush(
          com.linker.backend.entity.account.AuthIdentity.github(
              saved,
              Long.toString(9000000 + saved.getId()),
              saved.getUsername(),
              null,
              Instant.now()));
    return saved;
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
