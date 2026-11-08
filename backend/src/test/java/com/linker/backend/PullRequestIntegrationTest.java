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
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.*;
import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.integration.github.*;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.*;
import com.linker.backend.repository.github.GithubWebhookDeliveryRepository;
import com.linker.backend.repository.team.TeamRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.GithubPullRequestService;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(properties = "spring.jpa.show-sql=false")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Testcontainers
class PullRequestIntegrationTest {
  static final RsaMaterial KEYS = RsaMaterial.generate();
  static final Instant REV = Instant.parse("2026-11-07T15:00:00Z");
  @Container static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:16-alpine");
  @Container static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
    r.add("spring.data.redis.host", REDIS::getHost);
    r.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    r.add("linker.session.jwt-private-key", KEYS::privatePem);
    r.add("linker.session.jwt-public-key", KEYS::publicPem);
    r.add("linker.github.webhook-secret", () -> "p17-test-secret");
    r.add("linker.webhook.consumer-enabled", () -> "false");
    r.add("linker.team-setup.webhook-enabled", () -> "true");
    r.add("linker.team-setup.worker-enabled", () -> "false");
    r.add("linker.issues.sync-enabled", () -> "false");
    r.add("linker.issues.webhook-enabled", () -> "false");
  }
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired UserRepository users;
  @Autowired TeamRepository teams;
  @Autowired ChatRoomRepository rooms;
  @Autowired ChatRoomMemberRepository members;
  @Autowired GithubWebhookDeliveryRepository deliveries;
  @Autowired GithubWebhookService webhooks;
  @Autowired GithubPullRequestService requests;
  @Autowired AuthService sessions;
  @Autowired PlatformTransactionManager transactions;
  @Autowired com.linker.backend.service.user.ChatService chat;
  @Autowired org.springframework.data.redis.core.StringRedisTemplate redis;
  @MockitoBean GithubTeamSource github;
  @MockitoBean SimpMessagingTemplate messaging;
  final JsonMapper json = JsonMapper.builder().build();
  User owner, member, outsider;
  long team, room, installation, org, repoId, githubRepoId, prId;
  GithubTeamSource.Repository repo;
  GithubTeamSource.PullRequest live;

  @BeforeEach void seed() {
    owner = user(UserType.DEVELOPER);
    member = user(UserType.DEVELOPER);
    outsider = user(UserType.DEVELOPER);
    org = 100000 + owner.getId();
    installation = 200000 + owner.getId();
    githubRepoId = 300000 + owner.getId();
    prId = 400000 + owner.getId();
    var created = new TransactionTemplate(transactions).execute(tx -> teams.create(owner.getId(),
        new GithubInstallationView(installation, org, "org-" + org, null),
        new CreateTeamRequest("" + installation, "PR 팀", null), Instant.now()));
    team = created.id(); room = created.chatRoomId();
    jdbc.update("insert into team_members(team_id,user_id,role,github_org_state,joined_at,created_at,updated_at)"
        + " values (?,?,'MEMBER','MEMBER',now(),now(),now())", team, member.getId());
    members.saveAndFlush(ChatRoomMember.join(rooms.findById(room).orElseThrow(), member.getId()));
    repo = new GithubTeamSource.Repository(githubRepoId, "org-" + org, "repo", "org-" + org + "/repo",
        "keep metadata", "Java", 10, 1, "https://github.com/org-" + org + "/repo", true, false, null, "main");
    new TransactionTemplate(transactions).executeWithoutResult(tx -> teams.saveRepos(team, owner.getId(), List.of(repo), Instant.now()));
    repoId = teams.repoId(githubRepoId);
    live = snapshot("OPEN", REV);
    when(github.pullRequest(eq(installation), any(), eq(12))).thenAnswer(invocation -> {
      assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
      return live;
    });
    when(github.pullRequests(eq(installation), any())).thenAnswer(invocation -> {
      assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
      return List.of(live);
    });
  }

  @ParameterizedTest
  @CsvSource({"opened,false,OPENED", "review_requested,false,REVIEW_REQUESTED", "closed,true,MERGED", "closed,false,CLOSED"})
  void fourEventsSaveImmutableMessagesAndObjectPayloadForHistoryAndLive(String action, boolean merged, String event) throws Exception {
    live = snapshot(merged ? "MERGED" : action.equals("closed") ? "CLOSED" : "OPEN", REV);
    var delivery = deliver(action, merged, REV);
    assertThat(deliveries.findById(delivery.getId()).orElseThrow().getStatus().name()).isEqualTo("PROCESSED");
    assertThat(jdbc.queryForObject("select state from pull_requests where github_pr_id=?", String.class, prId)).isEqualTo(live.state());
    long message = jdbc.queryForObject("select id from chat_messages where room_id=? and message_type='PR_EVENT'", Long.class, room);
    mvc.perform(get(history()).cookie(cookie(member)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].type").value("PR_EVENT"))
        .andExpect(jsonPath("$.items[0].sender").isEmpty())
        .andExpect(jsonPath("$.items[0].payload.event").value(event))
        .andExpect(jsonPath("$.items[0].payload.prNumber").value(12))
        .andExpect(jsonPath("$.items[0].payload.githubRepoId").value(githubRepoId));
    var current = chat.currentTranscript(member.getId(), room, message);
    assertThat(json.readTree(json.writeValueAsString(current.payload())).path("event").asString()).isEqualTo(event);
    mvc.perform(delete(history() + "/" + message).cookie(cookie(owner))).andExpect(status().isForbidden());
    mvc.perform(patch(history() + "/" + message).cookie(cookie(owner))
        .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"수정\"}"))
        .andExpect(status().isForbidden());
    verify(messaging, times(1)).convertAndSend(eq("/topic/chat-rooms/" + room), any(Object.class));
  }

  @Test void redeliveryAndConcurrentBusinessReplayCreateOnlyOneMessage() throws Exception {
    var delivery = deliver("opened", false, REV);
    webhooks.dispatch(delivery.getId());
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first = executor.submit(() -> replayOrBusy(delivery));
      var second = executor.submit(() -> replayOrBusy(delivery));
      first.get(10, TimeUnit.SECONDS); second.get(10, TimeUnit.SECONDS);
    }
    requests.receive(delivery); // The durable queue retries a busy team after its lock is released.
    assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=? and message_type='PR_EVENT'", Long.class, room)).isEqualTo(1);
    verify(messaging, times(1)).convertAndSend(eq("/topic/chat-rooms/" + room), any(Object.class));
  }

  @Test void delayedOpenedEventCannotRegressMergedSourceAndFiltersUseCache() throws Exception {
    live = snapshot("MERGED", REV.plusSeconds(30));
    deliver("closed", true, REV.plusSeconds(30));
    deliver("opened", false, REV);
    mvc.perform(get(list() + "?state=open").cookie(cookie(member)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    mvc.perform(get(list() + "?state=merged").cookie(cookie(member)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].githubPrId").value(prId))
        .andExpect(jsonPath("$.items[0].githubRepoId").value(githubRepoId))
        .andExpect(jsonPath("$.items[0].state").value("merged"));
    assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, room)).isEqualTo(2);
  }

  @Test void editedAndPeriodicRefreshUpdateCacheWithoutInventingSystemEvents() throws Exception {
    deliver("edited", false, REV);
    assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, room)).isZero();
    live = snapshot("MERGED", REV.plusSeconds(1));
    requests.syncTeam(team);
    mvc.perform(get(list() + "?state=merged").cookie(cookie(owner)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
    assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, room)).isZero();
    verify(messaging, never()).convertAndSend(eq("/topic/chat-rooms/" + room), any(Object.class));
  }

  @Test void cacheAndMessageRollbackTogetherAndQueueCanRetry() throws Exception {
    jdbc.update("delete from chat_room_members where room_id=?", room);
    jdbc.update("delete from chat_rooms where id=?", room);
    var delivery = deliver("opened", false, REV);
    assertThat(deliveries.findById(delivery.getId()).orElseThrow().getStatus().name()).isEqualTo("FAILED");
    assertThat(jdbc.queryForObject("select count(*) from pull_requests where github_pr_id=?", Long.class, prId)).isZero();
    verify(messaging, never()).convertAndSend(eq("/topic/chat-rooms/" + room), any(Object.class));
    var restored = rooms.saveAndFlush(ChatRoom.team(team));
    room = restored.getId();
    members.saveAndFlush(ChatRoomMember.join(restored, owner.getId()));
    jdbc.update("update github_webhook_deliveries set processed_at=now()-interval '1 hour' where id=?", delivery.getId());
    webhooks.dispatch(delivery.getId());
    assertThat(deliveries.findById(delivery.getId()).orElseThrow().getStatus().name()).isEqualTo("PROCESSED");
    assertThat(jdbc.queryForObject("select count(*) from pull_requests where github_pr_id=?", Long.class, prId)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, room)).isEqualTo(1);
  }

  @Test void missingProviderResultIsFailedRatherThanAcknowledged() throws Exception {
    live = null;
    var delivery = deliver("opened", false, REV);
    assertThat(deliveries.findById(delivery.getId()).orElseThrow().getStatus().name()).isEqualTo("FAILED");
    assertThat(jdbc.queryForObject("select count(*) from pull_requests where github_pr_id=?", Long.class, prId)).isZero();
  }

  @Test void detachedRepositoriesAreExplicitlyNonTargetAndNotQueried() throws Exception {
    jdbc.update("delete from team_repos where team_id=?", team);
    var delivery = deliver("opened", false, REV);
    assertThat(deliveries.findById(delivery.getId()).orElseThrow().getStatus().name()).isEqualTo("PROCESSED");
    verifyNoInteractions(github);
  }

  @Test void outsiderRecruiterDirectRoomAndInvalidStateAreRejected() throws Exception {
    deliver("opened", false, REV);
    mvc.perform(get(list())).andExpect(status().isUnauthorized());
    mvc.perform(get(list()).cookie(cookie(outsider))).andExpect(status().isNotFound());
    mvc.perform(get(list()).cookie(cookie(user(UserType.RECRUITER)))).andExpect(status().isForbidden());
    mvc.perform(get(list() + "?state=closed").cookie(cookie(member))).andExpect(status().isBadRequest());
    var direct = rooms.saveAndFlush(ChatRoom.direct(owner.getId(), outsider.getId(), DmStatus.ACCEPTED, RequestKind.GENERAL, null));
    members.saveAndFlush(ChatRoomMember.join(direct, owner.getId()));
    mvc.perform(get("/api/v1/user/chat-rooms/" + direct.getId() + "/pull-requests").cookie(cookie(owner)))
        .andExpect(status().isNotFound());
  }

  @Test void suspendedCurrentMemberCanStillReadExistingPrCache() throws Exception {
    deliver("opened", false, REV);
    Cookie existing = cookie(member);
    member.suspendUntil(Instant.now().plusSeconds(3600));
    users.saveAndFlush(member);
    mvc.perform(get(list()).cookie(existing)).andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].githubPrId").value(prId));
  }

  @Test void brokenSignatureNeverEntersQueue() throws Exception {
    mvc.perform(post("/api/v1/webhook/github").header("X-GitHub-Delivery", UUID.randomUUID())
        .header("X-GitHub-Event", "pull_request").header("X-Hub-Signature-256", "sha256=" + "0".repeat(64))
        .contentType(MediaType.APPLICATION_JSON).content(body("opened", false, REV)))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(github);
  }

  @Test void olderProviderRevisionAndWrongIdentityRemainFailed() throws Exception {
    live = snapshot("OPEN", REV.minusSeconds(1));
    var delayed = deliver("opened", false, REV);
    assertThat(deliveries.findById(delayed.getId()).orElseThrow().getStatus().name()).isEqualTo("FAILED");
    live = new GithubTeamSource.PullRequest(prId + 1, 12, "다른 PR", "OPEN", false, "dev",
        "https://github.com/org/repo/pull/12", null, null, REV);
    var wrong = deliver("opened", false, REV);
    assertThat(deliveries.findById(wrong.getId()).orElseThrow().getStatus().name()).isEqualTo("FAILED");
    assertThat(jdbc.queryForObject("select count(*) from pull_requests where github_pr_id=?", Long.class, prId)).isZero();
  }

  @Test void mismatchedInstallationEnvelopeFailsBeforeProviderCall() {
    var bad = deliveries.saveAndFlush(GithubWebhookDelivery.received(UUID.randomUUID().toString(),
        "pull_request", "opened", installation + 1, body("opened", false, REV)));
    webhooks.dispatch(bad.getId());
    assertThat(deliveries.findById(bad.getId()).orElseThrow().getStatus().name()).isEqualTo("FAILED");
    verifyNoInteractions(github);
  }

  @Test void namesFollowNumericIdentityWithoutWipingOtherRepositoryMetadata() throws Exception {
    String newOrg = "renamed-" + org;
    live = new GithubTeamSource.PullRequest(prId, 12, "최신 PR", "OPEN", false, "dev",
        "https://github.com/" + newOrg + "/renamed/pull/12", null, null, REV);
    String renamed = body("opened", false, REV).replace("\"name\":\"repo\"", "\"name\":\"renamed\"")
        .replace("\"login\":\"org-" + org + "\"", "\"login\":\"" + newOrg + "\"");
    sendBody(renamed);
    mvc.perform(get(list()).cookie(cookie(member))).andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].repo").value(newOrg + "/renamed"));
    assertThat(jdbc.queryForObject("select primary_language from github_repos where id=?", String.class, repoId)).isEqualTo("Java");
    assertThat(jdbc.queryForObject("select stargazers_count from github_repos where id=?", Integer.class, repoId)).isEqualTo(10);
    verify(github).pullRequest(eq(installation), argThat(r -> r.id() == githubRepoId
        && r.owner().equals(newOrg) && r.name().equals("renamed")), eq(12));
  }

  @Test void transferredRepositoryDoesNotExposeNewCacheToOldTeam() throws Exception {
    deliver("opened", false, REV);
    long nextOrg = org + 1000000;
    long nextInstallation = installation + 1000000;
    var next = new TransactionTemplate(transactions).execute(tx -> teams.create(outsider.getId(),
        new GithubInstallationView(nextInstallation, nextOrg, "org-" + nextOrg, null),
        new CreateTeamRequest("" + nextInstallation, "새 팀", null), Instant.now()));
    var moved = new GithubTeamSource.Repository(githubRepoId, "org-" + nextOrg, "repo", "org-" + nextOrg + "/repo",
        null, null, 0, 0, null, true, false, null, "main");
    new TransactionTemplate(transactions).executeWithoutResult(tx -> teams.saveRepos(next.id(), outsider.getId(), List.of(moved), Instant.now()));
    mvc.perform(get(list()).cookie(cookie(member))).andExpect(jsonPath("$.items").isEmpty());
    var newer = new GithubTeamSource.PullRequest(prId, 12, "이전 후 비공개 제목", "OPEN", false, "dev",
        "https://github.com/" + moved.fullName() + "/pull/12", null, null, REV.plusSeconds(60));
    when(github.pullRequests(eq(nextInstallation), any())).thenReturn(List.of(newer));
    requests.syncTeam(next.id());
    mvc.perform(get(list()).cookie(cookie(member))).andExpect(jsonPath("$.items").isEmpty());
    mvc.perform(get("/api/v1/user/chat-rooms/" + next.chatRoomId() + "/pull-requests").cookie(cookie(outsider)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].title").value("이전 후 비공개 제목"));
    assertThat(jdbc.queryForObject("select team_id from pull_requests where github_pr_id=?", Long.class, prId)).isEqualTo(next.id());
  }

  @Test void periodicRefreshUsesTheSameActiveAndCompletedCadenceAsIssues() {
    requests.syncTeam(team);
    clearInvocations(github);
    requests.syncDueTeams();
    verify(github, never()).pullRequests(eq(installation), any());
    String key = "pull-requests:last-full-sync:" + team;
    redis.opsForValue().set(key, Instant.now().minusSeconds(16 * 60).toString());
    requests.syncDueTeams();
    verify(github).pullRequests(eq(installation), any());
    clearInvocations(github);
    jdbc.update("update teams set status='COMPLETED' where id=?", team);
    redis.opsForValue().set(key, Instant.now().minusSeconds(16 * 60).toString());
    requests.syncDueTeams();
    verify(github, never()).pullRequests(eq(installation), any());
    redis.opsForValue().set(key, Instant.now().minusSeconds(2 * 86400L).toString());
    requests.syncDueTeams();
    verify(github).pullRequests(eq(installation), any());
    assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, room)).isZero();
  }

  @Test void damagedPeriodicCheckpointIsRepairedAndProviderFailureRemainsRetryable() {
    String key = "pull-requests:last-full-sync:" + team;
    redis.opsForValue().set(key, "invalid-date");
    requests.syncDueTeams();
    verify(github).pullRequests(eq(installation), any());
    assertThatCode(() -> Instant.parse(redis.opsForValue().get(key))).doesNotThrowAnyException();
    clearInvocations(github);
    requests.syncDueTeams();
    verify(github, never()).pullRequests(eq(installation), any());

    String overdue = Instant.now().minusSeconds(16 * 60).toString();
    redis.opsForValue().set(key, overdue);
    when(github.pullRequests(eq(installation), any()))
        .thenThrow(new ApiException(503, "SERVICE_UNAVAILABLE", "provider unavailable"));
    requests.syncDueTeams();
    assertThat(redis.opsForValue().get(key)).isEqualTo(overdue);
    when(github.pullRequests(eq(installation), any())).thenReturn(List.of(live));
    requests.syncDueTeams();
    assertThat(redis.opsForValue().get(key)).isNotEqualTo(overdue);
    assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, room)).isZero();
  }

  private void replayOrBusy(GithubWebhookDelivery delivery) {
    try { requests.receive(delivery); }
    catch (ApiException busy) { assertThat(busy.getCode()).isEqualTo("STATE_CONFLICT"); }
  }

  private GithubWebhookDelivery deliver(String action, boolean merged, Instant revision) throws Exception {
    return sendBody(body(action, merged, revision));
  }

  private GithubWebhookDelivery sendBody(String body) throws Exception {
    String id = UUID.randomUUID().toString();
    var mac = javax.crypto.Mac.getInstance("HmacSHA256");
    mac.init(new javax.crypto.spec.SecretKeySpec("p17-test-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String signature = "sha256=" + HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    webhooks.accept(id, "pull_request", signature, body.getBytes(StandardCharsets.UTF_8));
    var delivery = deliveries.findByDeliveryId(id).orElseThrow();
    webhooks.dispatch(delivery.getId());
    return delivery;
  }
  private String body(String action, boolean merged, Instant revision) {
    return json.writeValueAsString(Map.of("action", action, "installation", Map.of("id", installation),
        "organization", Map.of("id", org), "number", 12,
        "repository", Map.of("id", githubRepoId, "name", "repo", "owner", Map.of("id", org, "type", "Organization", "login", "org-" + org)),
        "pull_request", Map.of("id", prId, "number", 12, "updated_at", revision.toString(), "merged", merged,
            "base", Map.of("repo", Map.of("id", githubRepoId)))));
  }
  private GithubTeamSource.PullRequest snapshot(String state, Instant revision) {
    return new GithubTeamSource.PullRequest(prId, 12, "최신 PR", state, false, "developer",
        "https://github.com/" + repo.fullName() + "/pull/12", state.equals("MERGED") ? revision : null,
        state.equals("OPEN") ? null : revision, revision);
  }
  private User user(UserType type) {
    User user = User.create("pr-" + UUID.randomUUID().toString().substring(0, 12), type);
    user.completeOnboarding(Instant.now()); return users.saveAndFlush(user);
  }
  private Cookie cookie(User user) { return new Cookie("linker_session", sessions.issue(user, "p17", "127.0.0.1").rawToken()); }
  private String history() { return "/api/v1/user/chat-rooms/" + room + "/messages"; }
  private String list() { return "/api/v1/user/chat-rooms/" + room + "/pull-requests"; }
}
