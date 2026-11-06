package com.linker.backend.service.user;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.team.response.TeamSetupResponse.Complete;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.TeamAccess;
import com.linker.backend.global.security.TeamRole;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.repository.team.TeamSetupLock;
import com.linker.backend.repository.team.TeamSetupRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.jdbc.core.JdbcTemplate;
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
  private final TeamSetupRepository teams;
  private final TeamSetupLock locks;
  private final TeamAccess access;
  private final GithubTeamSource github;
  private final IssueSyncService issues;
  private final NotificationService notifications;
  private final JdbcTemplate jdbc;
  private final Clock clock;
  private final TransactionTemplate write;

  public TeamSyncService(
      StringRedisTemplate redis,
      TeamSetupRepository teams,
      TeamSetupLock locks,
      TeamAccess access,
      GithubTeamSource github,
      IssueSyncService issues,
      NotificationService notifications,
      JdbcTemplate jdbc,
      Clock clock,
      PlatformTransactionManager manager) {
    this.redis = redis;
    this.teams = teams;
    this.locks = locks;
    this.access = access;
    this.github = github;
    this.issues = issues;
    this.notifications = notifications;
    this.jdbc = jdbc;
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
        locks.team(
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
      if (!access.hasRole(actor, teamId, TeamRole.Level.OWNER)
          || !Boolean.TRUE.equals(
              jdbc.queryForObject(
                  "select exists(select 1 from users where id=? and status='ACTIVE' and deleted_at is null)",
                  Boolean.class,
                  actor))) throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요");
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
    var now = Timestamp.from(clock.instant());
    for (var entry : snapshots.entrySet()) {
      long repo =
          jdbc.queryForObject(
              "select id from github_repos where github_repo_id=?",
              Long.class,
              entry.getKey().id());
      for (var pr : entry.getValue())
        jdbc.update(
            """
                    insert into pull_requests(team_id,repo_id,github_pr_id,number,title,state,draft,author_login,html_url,merged_at,closed_at,github_updated_at,created_at,updated_at)
                    values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    on conflict(github_pr_id) do update set title=excluded.title,state=excluded.state,draft=excluded.draft,author_login=excluded.author_login,
                    html_url=excluded.html_url,merged_at=excluded.merged_at,closed_at=excluded.closed_at,github_updated_at=excluded.github_updated_at,updated_at=excluded.updated_at
                    where pull_requests.github_updated_at<=excluded.github_updated_at
                    """,
            teamId,
            repo,
            pr.id(),
            pr.number(),
            pr.title(),
            pr.state(),
            pr.draft(),
            pr.author(),
            pr.url(),
            timestamp(pr.mergedAt()),
            timestamp(pr.closedAt()),
            timestamp(pr.updatedAt()),
            now,
            now);
    }
  }

  private void reconcileMembers(long teamId, List<Long> githubIds) {
    var members =
        jdbc.queryForList(
            """
                select m.user_id,m.github_org_state,ai.provider_user_id from team_members m
                join auth_identities ai on ai.user_id=m.user_id and ai.provider='GITHUB'
                where m.team_id=? and m.left_at is null
                """,
            teamId);
    for (var member : members) {
      long user = ((Number) member.get("user_id")).longValue();
      long github = Long.parseLong((String) member.get("provider_user_id"));
      if (githubIds.contains(github))
        jdbc.update(
            "update team_members set github_org_state='MEMBER',updated_at=? where team_id=? and user_id=? and left_at is null",
            timestamp(clock.instant()),
            teamId,
            user);
      else if ("MEMBER".equals(member.get("github_org_state"))) removeMember(teamId, user);
    }
  }

  private void removeMember(long teamId, long userId) {
    var now = timestamp(clock.instant());
    int changed =
        jdbc.update(
            "update team_members set left_at=?,leave_type='ORG_REMOVED',github_org_state='NOT_MEMBER',updated_at=? where team_id=? and user_id=? and left_at is null",
            now,
            now,
            teamId,
            userId);
    if (changed == 0) return;
    jdbc.update(
        "update chat_room_members m set left_at=?,updated_at=? from chat_rooms r where m.room_id=r.id and r.team_id=? and r.room_type='TEAM' and m.user_id=? and m.left_at is null",
        now,
        now,
        teamId,
        userId);
    var recipients =
        new HashSet<>(
            jdbc.queryForList(
                "select user_id from team_members where team_id=? and role='OWNER' and left_at is null",
                Long.class,
                teamId));
    recipients.add(userId);
    for (long recipient : recipients)
      if (Boolean.TRUE.equals(
          jdbc.queryForObject(
              "select exists(select 1 from users where id=? and status<>'DELETED' and deleted_at is null)",
              Boolean.class,
              recipient)))
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

  private static Timestamp timestamp(java.time.Instant value) {
    return value == null ? null : Timestamp.from(value);
  }

  private static String job(String member) {
    return "linker:team-setup:job:" + member;
  }

  public void installationChanged(long installationId, long orgId) {
    teams.requireSchema("teams", "github_installations");
    var linked = teams.linkedOrg(orgId);
    if (linked == null) return;
    locks.team(
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
                  jdbc.update(
                      "update github_installations set removed_at=coalesce(removed_at,?),updated_at=? where github_installation_id=?",
                      timestamp(clock.instant()),
                      timestamp(clock.instant()),
                      installationId);
                  markReadOnly(linked);
                } else {
                  long creator =
                      jdbc.queryForObject(
                          "select created_by from teams where id=?", Long.class, linked);
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
                  jdbc.update(
                      "update github_installations set suspended_at=? where id=?",
                      current.suspended() ? timestamp(clock.instant()) : null,
                      local);
                  jdbc.update(
                      "update teams set installation_id=?,github_org_login=?,updated_at=? where id=?",
                      local,
                      current.login(),
                      timestamp(clock.instant()),
                      linked);
                  if (current.suspended()) markReadOnly(linked);
                  else
                    jdbc.update(
                        "update teams set status='ACTIVE',read_only_since=null,updated_at=? where id=? and status='READ_ONLY'",
                        timestamp(clock.instant()),
                        linked);
                }
              });
          invalidate(linked);
          return null;
        });
  }

  private void markReadOnly(long teamId) {
    var now = timestamp(clock.instant());
    int changed =
        jdbc.update(
            "update teams set status='READ_ONLY',read_only_since=coalesce(read_only_since,?),updated_at=? where id=? and status in ('ACTIVE','COMPLETED')",
            now,
            now,
            teamId);
    if (changed > 0)
      for (long owner :
          jdbc.queryForList(
              "select m.user_id from team_members m join users u on u.id=m.user_id where m.team_id=? and m.role='OWNER' and m.left_at is null and u.status<>'DELETED' and u.deleted_at is null",
              Long.class,
              teamId))
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
    locks.team(
        linked,
        () -> {
          var team = teams.team(linked);
          if (team.installationId() != installationId) return null;
          var ids = github.memberIds(installationId, login, orgId);
          write.executeWithoutResult(
              status -> {
                teams.assertUnchanged(team);
                jdbc.update(
                    "update teams set github_org_login=?,updated_at=? where id=?",
                    login,
                    timestamp(clock.instant()),
                    linked);
                jdbc.update(
                    "update github_installations set account_login=?,updated_at=? where github_installation_id=?",
                    login,
                    timestamp(clock.instant()),
                    installationId);
                if (teams.ready("team_repos", "github_repos"))
                  jdbc.update(
                      """
                    update github_repos r set owner_login=?,full_name=?||'/'||r.name,updated_at=?
                    where r.owner_login=? and exists(select 1 from team_repos tr where tr.repo_id=r.id and tr.team_id=?)
                    """,
                      login,
                      login,
                      timestamp(clock.instant()),
                      team.orgLogin(),
                      linked);
                reconcileMembers(linked, ids);
              });
          return null;
        });
  }

  public void archiveReadOnly() {
    if (!teams.ready("teams")) return;
    var threshold =
        timestamp(
            clock
                .instant()
                .minus(
                    java.time.Duration.ofDays(
                        com.linker.backend.global.config.PlanLimits.TEAM_READ_ONLY_ARCHIVE_DAYS)));
    write.executeWithoutResult(
        status ->
            jdbc.update(
                "update teams set status='ARCHIVED',archived_at=?,updated_at=? where status='READ_ONLY' and read_only_since<=?",
                timestamp(clock.instant()),
                timestamp(clock.instant()),
                threshold));
  }
}
