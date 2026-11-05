package com.linker.backend.service.user;

import com.linker.backend.dto.issue.request.IssueListQuery;
import com.linker.backend.dto.issue.response.IssueRefreshResponse;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubAppClient;
import com.linker.backend.integration.github.IssueSource;
import com.linker.backend.repository.issue.IssueCacheRepository;
import com.linker.backend.repository.issue.IssueContextRepository;
import com.linker.backend.repository.issue.IssueContextRepository.Context;
import com.linker.backend.repository.issue.IssueSyncLock;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(propagation = Propagation.NEVER)
public class UserIssueSyncService {
  private final IssueContextRepository contexts;
  private final IssueCacheRepository cache;
  private final IssueSyncLock locks;
  private final IssueSource source;
  private final GithubAppClient installations;
  private final UserIssueService reads;
  private final StringRedisTemplate redis;
  private final Clock clock;

  public UserIssueSyncService(
      IssueContextRepository contexts,
      IssueCacheRepository cache,
      IssueSyncLock locks,
      IssueSource source,
      GithubAppClient installations,
      UserIssueService reads,
      StringRedisTemplate redis,
      Clock clock) {
    this.contexts = contexts;
    this.cache = cache;
    this.locks = locks;
    this.source = source;
    this.installations = installations;
    this.reads = reads;
    this.redis = redis;
    this.clock = clock;
  }

  /** B's page-08 setup-complete flow calls this after its transaction commits. */
  public int initialSync(long teamId) {
    return fullSync(teamId);
  }

  public int fullSync(long teamId) {
    return locks.team(
        teamId,
        () -> {
          var context = contexts.get(teamId);
          requireSyncable(context);
          String token = installations.installationReadToken(context.installationId());
          var project = source.project(context, token);
          List<IssueSource.RepositoryIssues> parts = new ArrayList<>();
          java.util.Set<Long> confirmedMissing = new java.util.HashSet<>();
          var old = cache.cached(teamId);
          for (var repo : context.repos()) {
            var current = new ArrayList<>(source.list(repo, token));
            var ids =
                current.stream()
                    .map(IssueSource.Issue::githubId)
                    .collect(java.util.stream.Collectors.toSet());
            for (var cached : old)
              if (cached.repoId() == repo.id() && !ids.contains(cached.githubId())) {
                try {
                  var found = source.issue(repo, cached.number(), token);
                  if (found.githubId() != cached.githubId()) throw conflict();
                  current.add(found);
                  ids.add(found.githubId());
                } catch (com.linker.backend.integration.github.MissingGithubIssueException e) {
                  confirmedMissing.add(cached.githubId());
                }
              }
            parts.add(new IssueSource.RepositoryIssues(repo, List.copyOf(current)));
          }
          int count =
              cache.apply(
                  context,
                  new IssueSource.Snapshot(List.copyOf(parts), project, confirmedMissing),
                  true,
                  clock.instant());
          redis.opsForValue().set(lastKey(teamId), clock.instant().toString(), Duration.ofDays(2));
          return count;
        });
  }

  public IssueRefreshResponse refresh(
      AuthenticatedUser user, long teamId, IssueListQuery query, boolean unscheduled) {
    reads.requireMember(user, teamId);
    if (!Boolean.TRUE.equals(
        redis
            .opsForValue()
            .setIfAbsent(
                "issues:refresh:" + user.userId() + ":" + teamId,
                "1",
                Duration.ofSeconds(PlanLimits.ISSUE_REFRESH_INTERVAL_SECONDS))))
      throw new ApiException(
          429,
          "RATE_LIMITED",
          "잠시 후 다시 시도해 주세요",
          Map.of("retryAfterSeconds", PlanLimits.ISSUE_REFRESH_INTERVAL_SECONDS));
    return locks.team(
        teamId,
        () -> {
          reads.requireMember(user, teamId);
          var context = contexts.get(teamId);
          requireSyncable(context);
          Set<Long> ids = Set.copyOf(reads.matchingIds(teamId, query, unscheduled));
          var selected = cache.cached(teamId).stream().filter(i -> ids.contains(i.id())).toList();
          if (selected.isEmpty()) return new IssueRefreshResponse(clock.instant(), 0);
          int count = refreshSelected(context, selected);
          return new IssueRefreshResponse(clock.instant(), count);
        });
  }

  public void addToProject(AuthenticatedUser user, long teamId, long issueId) {
    reads.requireMember(user, teamId);
    if (user.status() != com.linker.backend.entity.account.UserStatus.ACTIVE)
      throw new ApiException(403, "SUSPENDED", "정지된 계정은 이 기능을 쓸 수 없어요");
    locks.team(
        teamId,
        () -> {
          reads.requireMember(user, teamId);
          var context = contexts.get(teamId);
          requireSyncable(context);
          var issue =
              cache.cached(teamId).stream()
                  .filter(i -> i.id() == issueId)
                  .findFirst()
                  .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "이슈를 찾을 수 없어요"));
          var repo =
              context.repos().stream()
                  .filter(r -> r.id() == issue.repoId())
                  .findFirst()
                  .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "연결된 저장소를 찾을 수 없어요"));
          if (!source.canWrite(repo, user.userId()))
            throw new ApiException(403, "FORBIDDEN", "이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.");
          String token = installations.installationReadToken(context.installationId());
          var original = source.issue(repo, issue.number(), token);
          if (original.githubId() != issue.githubId() || !original.nodeId().equals(issue.nodeId()))
            throw conflict();
          var current = source.project(context, token);
          var existing = current.get(issue.nodeId());
          if (existing != null && existing.archived()) throw conflict();
          String item =
              existing == null
                  ? source.addToProject(context.board().nodeId(), issue.nodeId(), user.userId())
                  : existing.id();
          try {
            refreshSelected(context, List.of(issue));
            String confirmed =
                cache.cached(teamId).stream()
                    .filter(row -> row.id() == issue.id())
                    .map(IssueCacheRepository.Cached::itemId)
                    .filter(java.util.Objects::nonNull)
                    .findFirst()
                    .orElse(null);
            if (!item.equals(confirmed))
              throw new ApiException(503, "SERVICE_UNAVAILABLE", "프로젝트 추가 결과를 다시 확인하고 있어요");
          } catch (RuntimeException e) {
            cache.failedAdd(context, issue.id(), item);
            throw e;
          }
          return null;
        });
  }

  private int refreshSelected(Context context, List<IssueCacheRepository.Cached> selected) {
    String token = installations.installationReadToken(context.installationId());
    var items = source.project(context, token);
    List<IssueSource.RepositoryIssues> parts = new ArrayList<>();
    for (var repo : context.repos()) {
      List<IssueSource.Issue> issues = new ArrayList<>();
      for (var cached : selected)
        if (cached.repoId() == repo.id()) {
          var issue = source.issue(repo, cached.number(), token);
          if (issue.githubId() != cached.githubId()) throw conflict();
          issues.add(issue);
        }
      if (!issues.isEmpty()) parts.add(new IssueSource.RepositoryIssues(repo, List.copyOf(issues)));
    }
    return cache.apply(
        context, new IssueSource.Snapshot(List.copyOf(parts), items), false, clock.instant());
  }

  public void syncDueTeams() {
    for (long team : contexts.syncTeams()) {
      try {
        var context = contexts.get(team);
        String last = redis.opsForValue().get(lastKey(team));
        Duration interval =
            "ACTIVE".equals(context.status())
                ? Duration.ofMinutes(PlanLimits.ISSUE_ACTIVE_SYNC_MINUTES)
                : Duration.ofDays(1);
        if (last == null || !Instant.parse(last).plus(interval).isAfter(clock.instant()))
          fullSync(team);
      } catch (RuntimeException e) {
        org.slf4j.LoggerFactory.getLogger(getClass())
            .warn(
                "Issue periodic sync failed for team {} ({})", team, e.getClass().getSimpleName());
      }
    }
  }

  private static String lastKey(long team) {
    return "issues:last-full-sync:" + team;
  }

  private static void requireSyncable(Context context) {
    if (!context.writable()) throw new ApiException(403, "FORBIDDEN", "읽기 전용 팀에서는 이슈를 변경할 수 없어요");
  }

  private static ApiException conflict() {
    return new ApiException(409, "STATE_CONFLICT", "GitHub 이슈 정보가 바뀌었어요. 다시 확인해 주세요");
  }
}
