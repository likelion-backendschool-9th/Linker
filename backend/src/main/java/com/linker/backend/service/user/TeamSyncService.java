package com.linker.backend.service.user;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.team.response.TeamSetupResponse.Complete;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.TeamAccess;
import com.linker.backend.global.security.TeamRole;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.repository.team.TeamRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Durable Redis work/progress + role-owned org/PR sync. C keeps issue-sync implementation
 * ownership.
 */
@Service("userTeamSyncService")
@Transactional(propagation = Propagation.NEVER)
public class TeamSyncService {
  private static final String DUE = "linker:team-setup:due";
  private static final DefaultRedisScript<Long> ENQUEUE =
      new DefaultRedisScript<>(
          """
          local state=redis.call('HGET',KEYS[1],'state')
          if state and not (state=='FAILED' and ARGV[4]=='true') then return 0 end
          redis.call('HSET',KEYS[1],'state','QUEUED','actor',ARGV[1],'fingerprint',ARGV[2],'attempts',0)
          redis.call('HDEL',KEYS[1],'failedStep')
          redis.call('ZADD',KEYS[2],ARGV[3],ARGV[5])
          return 1
          """,
          Long.class);
  private final StringRedisTemplate redis;
  private final TeamRepository teams;
  private final TeamAccess access;
  private final GithubTeamSource github;
  private final IssueSyncService issues;
  private final NotificationService notifications;
  private final Clock clock;
  private final TransactionTemplate write;

  public TeamSyncService(
      StringRedisTemplate redis,
      TeamRepository teams,
      TeamAccess access,
      GithubTeamSource github,
      IssueSyncService issues,
      NotificationService notifications,
      Clock clock,
      PlatformTransactionManager manager) {
    this.redis = redis;
    this.teams = teams;
    this.access = access;
    this.github = github;
    this.issues = issues;
    this.notifications = notifications;
    this.clock = clock;
    write = new TransactionTemplate(manager);
  }

  public Complete enqueue(long teamId, long actor, boolean retry) {
    String fingerprint = fingerprint(teamId);
    String member = teamId + ":" + fingerprint;
    String key = job(member);
    redis.execute(
        ENQUEUE,
        List.of(key, DUE),
        Long.toString(actor),
        fingerprint,
        Long.toString(clock.millis()),
        Boolean.toString(retry),
        member);
    String state = (String) redis.opsForHash().get(key, "state");
    if (state == null) throw new ApiException(503, "SERVICE_UNAVAILABLE", "동기화 대기 상태를 확인해 주세요");
    return new Complete(
        List.of("QUEUED", "RUNNING").contains(state),
        state,
        (String) redis.opsForHash().get(key, "failedStep"));
  }

  /** Old queued jobs cannot apply to a different repo/board selection. */
  public void invalidate(long teamId) {
    // Fingerprinted jobs need no destructive reset. The next complete call queues the new context.
    redis.delete("linker:team-setup:completed:" + teamId);
  }

  public String fingerprint(long teamId) {
    var team = teams.team(teamId);
    String raw =
        team
            + "|"
            + teams.repos(teamId).stream().map(r -> Long.toString(r.id())).sorted().toList()
            + "|"
            + teams.boardId(teamId)
            + "|"
            + teams.setupRevision(teamId);
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException(exception);
    }
  }

  /**
   * Scheduled consumer may be disabled until prepared schemas are promoted. Public for isolated
   * integration tests.
   */
  public void drain() {
    Set<String> due = redis.opsForZSet().rangeByScore(DUE, 0, clock.millis(), 0, 20);
    if (due == null) return;
    for (String member : due) {
      try {
        long team = Long.parseLong(member.substring(0, member.indexOf(':')));
        teams.withTeamSetupLock(
            team,
            () -> {
              run(team, member);
              return null;
            });
      } catch (RuntimeException exception) {
        // Contention is retried by the durable sorted set; never delete an unclaimed job.
        org.slf4j.LoggerFactory.getLogger(getClass())
            .warn("Team setup job deferred ({})", exception.getClass().getSimpleName());
      }
    }
  }

  private void run(long teamId, String member) {
    String key = job(member);
    String state = (String) redis.opsForHash().get(key, "state");
    if ("COMPLETED".equals(state) || "FAILED".equals(state) || "STALE".equals(state)) {
      redis.opsForZSet().remove(DUE, member);
      return;
    }
    String failedStep = "CONTEXT";
    try {
      String expected = (String) redis.opsForHash().get(key, "fingerprint");
      if (!fingerprint(teamId).equals(expected)) {
        redis.opsForHash().put(key, "state", "STALE");
        redis.opsForZSet().remove(DUE, member);
        return;
      }
      long actor = Long.parseLong((String) redis.opsForHash().get(key, "actor"));
      if (!access.hasRole(actor, teamId, TeamRole.Level.OWNER) || !teams.isActiveUser(actor))
        throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요");
      var team = teams.team(teamId);
      if (!List.of("ACTIVE", "COMPLETED").contains(team.status()))
        throw new ApiException(409, "STATE_CONFLICT", "읽기 전용 팀에서는 동기화할 수 없어요");
      redis.opsForHash().put(key, "state", "RUNNING");
      failedStep = "ISSUES";
      // C owns all HTTP/cache/issue locking. No B transaction surrounds this call.
      issues.initialSync(teamId);
      redis.opsForHash().put(key, "issuesCompleted", "true");
      failedStep = "PULL_REQUESTS";
      var repos = teams.repos(teamId);
      var snapshots =
          new LinkedHashMap<GithubTeamSource.Repository, List<GithubTeamSource.PullRequest>>();
      for (var repo : repos) snapshots.put(repo, github.pullRequests(team.installationId(), repo));
      failedStep = "MEMBERS";
      var memberIds = github.memberIds(team.installationId(), team.orgLogin(), team.orgId());
      write.executeWithoutResult(
          status -> {
            teams.assertUnchanged(team);
            if (!fingerprint(teamId).equals(expected)
                || !access.hasRole(actor, teamId, TeamRole.Level.OWNER))
              throw new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요");
            savePullRequests(teamId, snapshots);
            reconcileMembers(teamId, memberIds);
          });
      redis.opsForHash().put(key, "state", "COMPLETED");
      redis.opsForHash().delete(key, "failedStep");
      redis.opsForValue().set("linker:team-setup:completed:" + teamId, expected);
      redis.opsForZSet().remove(DUE, member);
    } catch (RuntimeException exception) {
      long attempts = redis.opsForHash().increment(key, "attempts", 1);
      redis.opsForHash().put(key, "failedStep", failedStep);
      if (attempts >= 3) {
        redis.opsForHash().put(key, "state", "FAILED");
        redis.opsForZSet().remove(DUE, member);
      } else {
        redis.opsForHash().put(key, "state", "QUEUED");
        redis.opsForZSet().add(DUE, member, clock.millis() + 30000);
      }
      // Never persist credentials, provider bodies, raw exception messages, or user input in job
      // errors.
    }
  }

  private void savePullRequests(
      long teamId, Map<GithubTeamSource.Repository, List<GithubTeamSource.PullRequest>> snapshots) {
    teams.requireSchema("pull_requests");
    for (var entry : snapshots.entrySet()) {
      long repo = teams.repoId(entry.getKey().id());
      for (var pr : entry.getValue()) teams.cachePullRequest(teamId, repo, pr, clock.instant());
    }
  }

  private void reconcileMembers(long teamId, List<Long> githubIds) {
    for (var member : teams.githubMembers(teamId)) {
      long user = member.userId();
      if (githubIds.contains(Long.parseLong(member.githubUserId())))
        teams.confirmMember(teamId, user, clock.instant());
      else if ("MEMBER".equals(member.githubState())) removeMember(teamId, user);
    }
  }

  private void removeMember(long teamId, long userId) {
    var now = clock.instant();
    if (teams.removeOrgMember(teamId, userId, now) == 0) return;
    teams.closeChatMembership(teamId, userId, now);
    var recipients = new HashSet<>(teams.currentOwnerIds(teamId, false));
    recipients.add(userId);
    for (long recipient : recipients)
      if (teams.canReceiveNotification(recipient))
        notifications.create(
            new CreateNotificationCommand(
                recipient,
                "TEAM_MEMBER_REMOVED",
                null,
                "TEAM",
                teamId,
                "/workspace",
                null,
                "org-member-removed:" + teamId + ":" + userId));
  }

  private static String job(String member) {
    return "linker:team-setup:job:" + member;
  }

  public void installationChanged(long installationId, long orgId) {
    teams.requireSchema("teams", "github_installations");
    var linked = teams.linkedOrg(orgId);
    if (linked == null) return;
    teams.withTeamSetupLock(
        linked,
        () -> {
          // Read after acquiring the session lock: a waiting older event cannot reuse stale truth.
          // The lock is not a DB transaction, so this provider call remains outside transactions.
          var current = github.installation(installationId);
          if (current != null && current.orgId() != orgId)
            throw new ApiException(400, "VALIDATION_ERROR", "설치 조직을 확인해 주세요");
          write.executeWithoutResult(
              status -> {
                var team = teams.team(linked);
                teams.assertUnchanged(team);
                if (current == null) {
                  // An old installation's deletion must not disable its verified replacement.
                  if (team.installationId() != installationId) return;
                  teams.markInstallationRemoved(installationId, clock.instant());
                  markReadOnly(linked);
                } else {
                  long creator = teams.creatorId(linked);
                  long local =
                      teams.upsertInstallation(
                          creator,
                          new com.linker.backend.dto.github.response.GithubInstallationView(
                              current.id(),
                              current.orgId(),
                              current.login(),
                              "",
                              current.repositorySelection()),
                          clock.instant());
                  teams.suspendInstallation(local, current.suspended() ? clock.instant() : null);
                  teams.linkInstallation(linked, local, current.login(), clock.instant());
                  if (current.suspended()) markReadOnly(linked);
                  else teams.restoreActive(linked, clock.instant());
                }
              });
          invalidate(linked);
          return null;
        });
  }

  private void markReadOnly(long teamId) {
    if (teams.markReadOnly(teamId, clock.instant()) > 0)
      for (long owner : teams.currentOwnerIds(teamId, true))
        notifications.create(
            new CreateNotificationCommand(
                owner,
                "TEAM_APP_REMOVED",
                null,
                "TEAM",
                teamId,
                "/teams/" + teamId + "/settings",
                null,
                "team-app-unavailable:" + teamId));
  }

  public void organizationChanged(long installationId, long orgId, String login) {
    teams.requireSchema("teams", "github_installations");
    var linked = teams.linkedOrg(orgId);
    if (linked == null) return;
    teams.withTeamSetupLock(
        linked,
        () -> {
          var team = teams.team(linked);
          if (team.installationId() != installationId) return null;
          var ids = github.memberIds(installationId, login, orgId);
          write.executeWithoutResult(
              status -> {
                teams.assertUnchanged(team);
                teams.renameOrganization(
                    linked, installationId, team.orgLogin(), login, clock.instant());
                reconcileMembers(linked, ids);
              });
          return null;
        });
  }

  public void archiveReadOnly() {
    if (!teams.ready("teams")) return;
    var threshold =
        clock
            .instant()
            .minus(
                java.time.Duration.ofDays(
                    com.linker.backend.global.config.PlanLimits.TEAM_READ_ONLY_ARCHIVE_DAYS));
    write.executeWithoutResult(status -> teams.archiveReadOnly(threshold, clock.instant()));
  }
}
