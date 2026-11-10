package com.linker.backend.service.user;

import com.linker.backend.dto.issue.response.IssueProgressResponse;
import com.linker.backend.dto.issue.response.IssueProgressResponse.*;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.issue.IssueRepository;
import com.linker.backend.repository.issue.TeamProgressSnapshotRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service("userIssueProgressService")
public class IssueProgressService {
  private final IssueRepository issueRepository;
  private final TeamProgressSnapshotRepository snapshots;
  private final IssueService reads;
  private final Clock clock;

  public IssueProgressService(
      IssueRepository issueRepository,
      TeamProgressSnapshotRepository snapshots,
      IssueService reads,
      Clock clock) {
    this.issueRepository = issueRepository;
    this.snapshots = snapshots;
    this.reads = reads;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public IssueProgressResponse progress(AuthenticatedUser user, long teamId, int days) {
    reads.requireMember(user, teamId);
    if (days != PlanLimits.ISSUE_PROGRESS_DAYS)
      throw com.linker.backend.dto.issue.request.IssueListQuery.invalid();
    if (!issueRepository.subscriptionsReady()) throw IssueRepository.unavailable();
    if (!issueRepository.flexActive(teamId, clock.instant()))
      throw new ApiException(
          403, "PLAN_LIMIT", "Flex를 구독하면 팀 진행 현황을 볼 수 있어요", Map.of("reason", "PROGRESS_GRAPH"));
    LocalDate today = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE));
    var counts = issueRepository.progressCounts(teamId);
    long total = counts.todo() + counts.inProgress() + counts.blocked() + counts.done();
    Map<LocalDate, Day> byDate = new java.util.HashMap<>();
    for (var stored : snapshots.findHistory(teamId, today.minusDays(days - 1), today))
      byDate.put(
          stored.getSnapshotDate(),
          new Day(
              stored.getSnapshotDate(),
              (long) stored.getTodoCount(),
              (long) stored.getInProgressCount(),
              (long) stored.getBlockedCount(),
              (long) stored.getDoneCount()));
    var history =
        java.util.stream.IntStream.range(0, days)
            .mapToObj(i -> {
              var date = today.minusDays(days - 1 - i);
              return date.equals(today)
                  ? new Day(
                      today, counts.todo(), counts.inProgress(), counts.blocked(), counts.done())
                  : byDate.getOrDefault(date, new Day(date, null, null, null, null));
            })
            .toList();
    var loads = issueRepository.openWorkloads(teamId);
    long overdue = issueRepository.overdueCount(teamId, today);
    long soon = issueRepository.dueSoonCount(teamId, today, today.plusDays(3));
    return new IssueProgressResponse(
        new Completion(
            counts.done(), total, total == 0 ? 0 : (int) Math.round(100.0 * counts.done() / total)),
        counts,
        history,
        loads,
        overdue,
        soon);
  }

  /** Midnight stores the day just ended; today's live value is never backfilled as history. */
  @Transactional
  public void snapshot() {
    var today = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE));
    snapshots.insertDaily(today.minusDays(1), today);
    snapshots.deleteOlderThan(today.minusYears(1));
  }
}
