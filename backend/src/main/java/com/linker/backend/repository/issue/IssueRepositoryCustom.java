package com.linker.backend.repository.issue;

import com.linker.backend.dto.issue.request.IssueListQuery;
import com.linker.backend.dto.issue.response.IssueDetailResponse.Person;
import com.linker.backend.dto.issue.response.IssueDetailResponse.SubIssues;
import com.linker.backend.dto.issue.response.IssueFilterOptionsResponse;
import com.linker.backend.dto.issue.response.IssueListResponse;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Cached;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Context;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Reminder;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Row;
import com.linker.backend.dto.issue.response.IssueProgressResponse.Counts;
import com.linker.backend.dto.issue.response.IssueProgressResponse.Workload;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.IssueSource;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Supplier;

public interface IssueRepositoryCustom {

  // Team connection (B's tables, read through TeamRepository)

  /** Team, installation, board (required) and linked repos. 404 when any is missing. */
  Context context(long teamId);

  /** Teams whose issues are synced periodically: ACTIVE/COMPLETED with a live installation. */
  List<Long> syncTeams();

  /** Non-deleted teams served by a live installation (external GitHub installation ID). */
  List<Long> webhookTeams(long installationId);

  /**
   * Session advisory lock covering source READ through cache COMMIT across instances and entry
   * points. Must start outside a transaction.
   */
  <T> T withTeamLock(long teamId, Supplier<T> action);

  // Cache writes (source reads under the team lock)

  List<Cached> cached(long teamId);

  int apply(Context expected, IssueSource.Snapshot source, boolean full, Instant now);

  void failedAdd(Context expected, long issueId, String confirmedItemId);

  /** Caller holds the team lock and a short transaction, after the full source read completes. */
  void subIssues(long team, long parent, SubIssues children);

  void markCreatedViaLinker(long issue, long actor, boolean done);

  // Pages 11, 14, 15 reads

  IssueListResponse list(long teamId, IssueListQuery query, boolean unscheduled, LocalDate today);

  List<IssueListResponse.Item> board(long teamId, IssueListQuery query, LocalDate today);

  List<IssueListResponse.Item> calendar(
      long teamId, LocalDate from, LocalDate to, String assignee, LocalDate today);

  IssueFilterOptionsResponse options(long teamId);

  // Page 12 detail

  Row detail(long team, long id);

  List<IssueListResponse.Assignee> assignees(long team, long issue);

  List<IssueListResponse.Label> labels(long issue);

  Person author(long githubId, String login);

  List<Person> assigneeCandidates(long team);

  Long linkedId(long team, long github);

  AuthenticatedUser actor(long user);

  /** Linker users of a GitHub assignee who are current members of the team. */
  List<Long> assigneeRecipients(long team, long github);

  // Page 15 due reminders

  List<Reminder> reminderCandidates(long team, LocalDate due);

  /** Called in the same short transaction as NotificationService.create. */
  boolean reminderEligible(Reminder reminder);

  boolean reminderClaimed(String key, long recipient);

  // Page 11 Flex progress card

  boolean subscriptionsReady();

  boolean flexActive(long teamId, Instant now);

  Counts progressCounts(long teamId);

  List<Workload> openWorkloads(long teamId);

  long overdueCount(long teamId, LocalDate today);

  long dueSoonCount(long teamId, LocalDate today, LocalDate soon);
}
