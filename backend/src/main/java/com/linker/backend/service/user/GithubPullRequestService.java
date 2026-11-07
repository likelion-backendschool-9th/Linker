package com.linker.backend.service.user;

import com.linker.backend.dto.chat.request.PostPullRequestEventCommand;
import com.linker.backend.dto.github.response.ChatPullRequestsResponse;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.type.RoomType;
import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.entity.github.type.PullRequestState;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.TeamAccess;
import com.linker.backend.global.security.TeamRole;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.integration.github.GithubTeamSource.Repository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.github.PullRequestRepository;
import com.linker.backend.repository.team.TeamRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Role-owned list/refresh orchestration. GitHub HTTP never inherits a DB transaction. */
@Service("userGithubPullRequestService")
@Transactional(propagation = Propagation.NEVER)
public class GithubPullRequestService {
  private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GithubPullRequestService.class);
  private static final String ACTIVE = "linker:pull-requests:active-teams";
  private static final Set<String> ACTIONS = Set.of("assigned", "unassigned", "auto_merge_enabled",
      "auto_merge_disabled", "closed", "converted_to_draft", "demilestoned", "dequeued",
      "edited", "enqueued", "labeled", "unlabeled", "locked", "unlocked", "milestoned",
      "opened", "ready_for_review", "reopened", "review_requested", "review_request_removed", "synchronize");
  private final TeamRepository teams;
  private final PullRequestRepository requests;
  private final ChatRoomMemberRepository members;
  private final TeamAccess access;
  private final GithubTeamSource github;
  private final ChatService chat;
  private final StringRedisTemplate redis;
  private final Clock clock;
  private final TransactionTemplate write;
  private final TransactionTemplate read;
  private final JsonMapper json = JsonMapper.builder().build();

  public GithubPullRequestService(TeamRepository teams, PullRequestRepository requests,
      ChatRoomMemberRepository members, TeamAccess access, GithubTeamSource github, ChatService chat,
      StringRedisTemplate redis, Clock clock, PlatformTransactionManager transactions) {
    this.teams = teams;
    this.requests = requests;
    this.members = members;
    this.access = access;
    this.github = github;
    this.chat = chat;
    this.redis = redis;
    this.clock = clock;
    this.write = new TransactionTemplate(transactions);
    this.read = new TransactionTemplate(transactions);
    this.read.setReadOnly(true);
  }

  public ChatPullRequestsResponse list(AuthenticatedUser user, long roomId, String rawState) {
    if (user == null) throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
    if (user.userType() != UserType.DEVELOPER)
      throw new ApiException(403, "DEVELOPER_ONLY", "개발자만 사용할 수 있어요");
    String state = rawState == null ? "open" : rawState.toLowerCase(Locale.ROOT);
    if (!Set.of("open", "merged").contains(state)) throw invalid();
    final long[] teamId = new long[1];
    var result = read.execute(status -> {
      teams.requireActive(user.userId());
      var member = members.findActive(roomId, user.userId()).orElseThrow(GithubPullRequestService::notFound);
      var room = member.getRoom();
      if (room.getRoomType() != RoomType.TEAM || room.getTeamId() == null
          || !access.hasRole(user.userId(), room.getTeamId(), TeamRole.Level.MEMBER)) throw notFound();
      teamId[0] = room.getTeamId();
      var linked = teams.findLinkedRepos(teamId[0]).stream()
          .collect(Collectors.toMap(com.linker.backend.dto.team.response.TeamConnectionView.LinkedRepo::repoId,
              Function.identity()));
      var items = requests.findLinkedByState(teamId[0], PullRequestState.valueOf(state.toUpperCase(Locale.ROOT)))
          .stream().filter(pr -> linked.containsKey(pr.getRepoId())).map(pr -> {
            var repo = linked.get(pr.getRepoId());
            return new ChatPullRequestsResponse.Item(pr.getId(), repo.repoId(), repo.githubRepoId(),
                pr.getGithubPrId(), repo.ownerLogin() + "/" + repo.name(), pr.getNumber(), pr.getTitle(),
                pr.getState().name().toLowerCase(Locale.ROOT), pr.isDraft(), pr.getAuthorLogin(), pr.getHtmlUrl());
          }).toList();
      return new ChatPullRequestsResponse(items);
    });
    // Activity is technical cache state, recorded after the DB read transaction is closed.
    redis.opsForZSet().add(ACTIVE, Long.toString(teamId[0]), clock.millis());
    return result;
  }

  public void receive(GithubWebhookDelivery delivery) {
    JsonNode body = json.readTree(delivery.getPayload());
    JsonNode repo = body.path("repository");
    JsonNode pr = body.path("pull_request");
    String action = body.path("action").asString("");
    long installation = body.path("installation").path("id").asLong(0);
    long orgId = repo.path("owner").path("id").asLong(0);
    long repoId = repo.path("id").asLong(0);
    long prId = pr.path("id").asLong(0);
    int number = pr.path("number").asInt(0);
    if (!"pull_request".equals(delivery.getEvent()) || !action.equals(delivery.getAction())
        || !ACTIONS.contains(action) || installation <= 0
        || !body.path("installation").path("id").isIntegralNumber()
        || !repo.path("id").isIntegralNumber() || !repo.path("owner").path("id").isIntegralNumber()
        || !pr.path("id").isIntegralNumber() || !pr.path("number").isIntegralNumber()
        || !Objects.equals(delivery.getInstallationId(), installation)
        || !"Organization".equals(repo.path("owner").path("type").asString(""))
        || orgId <= 0 || repoId <= 0 || prId <= 0 || number <= 0
        || body.path("number").asInt(0) != number
        || pr.path("base").path("repo").path("id").asLong(0) != repoId
        || (body.has("organization") && body.path("organization").path("id").asLong(0) != orgId)) throw invalid();
    Instant revision;
    try { revision = Instant.parse(pr.path("updated_at").asString("")); }
    catch (RuntimeException exception) { throw invalid(); }
    Long teamId = teams.findPullRequestTeam(installation, orgId, repoId).orElse(null);
    // An installation may include repositories not selected for Linker. Initial setup sync handles
    // events that arrived before any team was created; those are explicitly non-target receipts.
    if (teamId == null) return;
    String event = switch (action) {
      case "opened" -> "OPENED";
      case "review_requested" -> "REVIEW_REQUESTED";
      case "closed" -> pr.path("merged").asBoolean(false) ? "MERGED" : "CLOSED";
      default -> null;
    };
    teams.withTeamSetupLock(teamId, () -> {
      var expected = teams.team(teamId);
      var cached = teams.repos(teamId).stream().filter(r -> r.id() == repoId).findFirst().orElseThrow();
      String owner = repo.path("owner").path("login").asString("");
      String name = repo.path("name").asString("");
      if (owner.isBlank() || name.isBlank()) throw invalid();
      // Canonical webhook names handle a rename without treating the name as repository identity.
      Repository canonical = new Repository(cached.id(), owner, name, owner + "/" + name,
          cached.description(), cached.language(), cached.stars(), cached.forks(), cached.htmlUrl(),
          cached.isPrivate(), cached.isFork(), cached.parentFullName(), cached.defaultBranch());
      var live = github.pullRequest(installation, canonical, number);
      requireLive(live, prId, number, revision);
      write.executeWithoutResult(status -> {
        teams.assertUnchanged(expected);
        if (!Objects.equals(teams.findPullRequestTeam(installation, orgId, repoId).orElse(null), teamId))
          throw new ApiException(409, "STATE_CONFLICT", "팀 저장소 연결이 바뀌었어요");
        if (!expected.orgLogin().equals(owner))
          teams.renameOrganization(teamId, installation, expected.orgLogin(), owner, clock.instant());
        teams.renameGithubRepository(repoId, owner, name, clock.instant());
        long localRepo = teams.repoId(repoId);
        teams.cachePullRequest(teamId, localRepo, live, clock.instant());
        if (event != null) chat.postPullRequestEvent(new PostPullRequestEventCommand(teamId,
            digest(delivery.getDeliveryId()), localRepo, repoId, prId, canonical.fullName(), number,
            live.title(), event, live.url()));
      });
      return null;
    });
  }

  public void syncTeam(long teamId) {
    teams.withTeamSetupLock(teamId, () -> {
      var expected = teams.team(teamId);
      if (!Set.of("ACTIVE", "COMPLETED").contains(expected.status())) return null;
      var linked = teams.repos(teamId);
      var snapshots = new LinkedHashMap<Repository, List<GithubTeamSource.PullRequest>>();
      for (var repo : linked) snapshots.put(repo, github.pullRequests(expected.installationId(), repo));
      write.executeWithoutResult(status -> {
        teams.assertUnchanged(expected);
        for (var entry : snapshots.entrySet()) {
          long localRepo = teams.repoId(entry.getKey().id());
          for (var pr : entry.getValue()) {
            requireLive(pr, pr.id(), pr.number(), Instant.MIN);
            teams.cachePullRequest(teamId, localRepo, pr, clock.instant());
          }
        }
      });
      return null;
    });
  }

  public void syncActive() {
    double threshold = clock.millis() - java.time.Duration.ofMinutes(
        com.linker.backend.global.config.PlanLimits.ISSUE_ACTIVE_SYNC_MINUTES).toMillis();
    redis.opsForZSet().removeRangeByScore(ACTIVE, Double.NEGATIVE_INFINITY, threshold);
    var ids = redis.opsForZSet().rangeByScore(ACTIVE, threshold, Double.POSITIVE_INFINITY);
    if (ids != null) for (String id : ids) refreshSafely(Long.parseLong(id));
  }

  public void syncDaily() {
    for (long id : teams.findPullRequestSyncTeams()) refreshSafely(id);
  }

  private void refreshSafely(long teamId) {
    try { syncTeam(teamId); }
    catch (RuntimeException exception) {
      // A failed org must not delay the other teams; the next scheduled run retries it.
      log.warn("PR cache refresh failed for team {}: {}", teamId, exception.getClass().getSimpleName());
    }
  }

  private static void requireLive(GithubTeamSource.PullRequest pr, long id, int number, Instant revision) {
    if (pr == null || id <= 0 || number <= 0 || pr.id() != id || pr.number() != number
        || pr.updatedAt() == null || pr.updatedAt().isBefore(revision) || pr.title() == null
        || pr.state() == null || !Set.of("OPEN", "CLOSED", "MERGED").contains(pr.state()) || pr.url() == null
        || !pr.url().startsWith("https://github.com/"))
      throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub PR의 최신 상태를 확인하지 못했어요");
  }

  private static String digest(String value) {
    try {
      // Keep V3's varchar(36) unchanged. This namespaced, deterministic 128-bit key is dedupe
      // metadata, not a credential; the room lock serializes check/insert for NULL system senders.
      var bytes = java.nio.ByteBuffer.wrap(MessageDigest.getInstance("SHA-256")
          .digest(("github-pr:" + value).getBytes(StandardCharsets.UTF_8)));
      return new UUID(bytes.getLong(), bytes.getLong()).toString();
    }
    catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
  }

  private static ApiException invalid() {
    return new ApiException(400, "VALIDATION_ERROR", "GitHub PR 정보를 확인해 주세요");
  }
  private static ApiException notFound() {
    return new ApiException(404, "NOT_FOUND", "팀 채팅방을 찾지 못했어요");
  }
}
