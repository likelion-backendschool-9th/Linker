package com.linker.backend.service.user;

import com.linker.backend.dto.issue.request.IssueListQuery;
import com.linker.backend.dto.issue.response.IssueBoardResponse;
import com.linker.backend.dto.issue.response.IssueDetailResponse;
import com.linker.backend.dto.issue.response.IssueFilterOptionsResponse;
import com.linker.backend.dto.issue.response.IssueListResponse;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.IssueSource;
import com.linker.backend.repository.issue.IssueContextRepository;
import com.linker.backend.repository.issue.IssueReadRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service("userIssueService")
@Transactional(propagation = Propagation.NEVER)
public class IssueService {
  private final UserIssueAccess access;
  private final IssueTemplateService templates;
  private final IssueCreateService creation;
  private final IssueDetailService detail;
  private final IssueReadRepository issues;
  private final Clock clock;
  private final IssueContextRepository contexts;
  private final IssueSource source;
  private final TransactionTemplate read;

  public IssueService(
      UserIssueAccess access,
      IssueTemplateService templates,
      IssueCreateService creation,
      IssueDetailService detail,
      IssueReadRepository issues,
      Clock clock,
      IssueContextRepository contexts,
      IssueSource source,
      PlatformTransactionManager manager) {
    this.access = access;
    this.templates = templates;
    this.creation = creation;
    this.detail = detail;
    this.issues = issues;
    this.clock = clock;
    this.contexts = contexts;
    this.source = source;
    this.read = new TransactionTemplate(manager);
    read.setReadOnly(true);
    read.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
  }

  public IssueListResponse list(
      AuthenticatedUser user, long teamId, IssueListQuery query, boolean unscheduled) {
    requireMember(user, teamId);
    var context = contexts.get(teamId);
    var permission = writePermission(user, context);
    return read.execute(
        status -> {
          requireMember(user, teamId);
          if (!contexts.get(teamId).equals(context))
            throw new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요");
          var page =
              issues.list(
                  teamId, query, unscheduled, LocalDate.now(clock.withZone(PlanLimits.APP_ZONE)));
          return new IssueListResponse(
              page.items(),
              page.nextCursor(),
              page.total(),
              permission.allowed(),
              permission.why());
        });
  }

  /**
   * Page 14 status board. Same membership, team-binding and write-permission rules as the page 11
   * list; moves borrow page 12's status API. A card without a Status value ({@code NONE}) is shown
   * in "기타" so it can still be moved; its own status stays {@code NONE}.
   */
  public IssueBoardResponse board(AuthenticatedUser user, long teamId, IssueListQuery query) {
    requireMember(user, teamId);
    var context = contexts.get(teamId);
    var permission = writePermission(user, context);
    return read.execute(
        status -> {
          requireMember(user, teamId);
          if (!contexts.get(teamId).equals(context))
            throw new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요");
          var cards =
              issues.board(teamId, query, LocalDate.now(clock.withZone(PlanLimits.APP_ZONE)));
          List<IssueBoardResponse.Column> columns = new ArrayList<>();
          for (var column : BOARD_COLUMNS.entrySet()) {
            String key = column.getKey();
            columns.add(
                new IssueBoardResponse.Column(
                    key,
                    column.getValue(),
                    cards.stream()
                        .filter(card -> key.equals(boardColumn(card.status())))
                        .toList()));
          }
          return new IssueBoardResponse(
              permission.allowed(), permission.why(), List.copyOf(columns));
        });
  }

  public com.linker.backend.dto.issue.response.IssueCalendarResponse calendar(
      AuthenticatedUser user, long teamId, LocalDate from, LocalDate to, String assignee) {
    requireMember(user, teamId);
    // Transport/database-compatible ISO dates, not a product limit on the visible range.
    if (from == null || to == null || from.isAfter(to) || from.getYear() < 1 || to.getYear() > 9999)
      throw IssueListQuery.invalid();
    var query =
        new IssueListQuery(null, null, assignee, null, false, null, IssueListQuery.MAX_SIZE);
    var context = contexts.get(teamId);
    return read.execute(
        st -> {
          requireMember(user, teamId);
          if (!contexts.get(teamId).equals(context))
            throw new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요");
          return new com.linker.backend.dto.issue.response.IssueCalendarResponse(
              from,
              to,
              issues.calendar(
                  teamId,
                  from,
                  to,
                  query.assignee(),
                  LocalDate.now(clock.withZone(PlanLimits.APP_ZONE))));
        });
  }

  /** Column order and labels from Policy POL-I-3 / Page TODO 14. */
  private static final Map<String, String> BOARD_COLUMNS = boardColumns();

  private static Map<String, String> boardColumns() {
    Map<String, String> columns = new LinkedHashMap<>();
    columns.put("TODO", "작업 전");
    columns.put("IN_PROGRESS", "작업 중");
    columns.put("BLOCKED", "작업 중단");
    columns.put("DONE", "작업 완료");
    columns.put("OTHER", "기타");
    return Collections.unmodifiableMap(columns);
  }

  private static String boardColumn(String status) {
    return "NONE".equals(status) ? "OTHER" : status;
  }

  private record WritePermission(boolean allowed, String why) {}

  /** Repo write on any linked repo, an active account and a writable team (Policy ch. 7). */
  private WritePermission writePermission(
      AuthenticatedUser user, IssueContextRepository.Context context) {
    if (!context.writable()) return new WritePermission(false, "READ_ONLY_TEAM");
    if (user.status() == UserStatus.SUSPENDED) return new WritePermission(false, "SUSPENDED");
    String reason = "NO_REPOSITORY_WRITE_PERMISSION";
    for (var repo : context.repos()) {
      try {
        if (source.canWrite(repo, user.userId())) return new WritePermission(true, null);
      } catch (ApiException e) {
        reason = "GITHUB_PERMISSION_UNAVAILABLE";
      }
    }
    return new WritePermission(false, reason);
  }

  public IssueFilterOptionsResponse options(AuthenticatedUser user, long teamId) {
    requireMember(user, teamId);
    contexts.get(teamId);
    return read.execute(
        status -> {
          requireMember(user, teamId);
          return issues.options(teamId);
        });
  }

  List<Long> matchingIds(long teamId, IssueListQuery query, boolean unscheduled) {
    return read.execute(
        status -> {
          List<Long> ids = new ArrayList<>();
          String cursor = null;
          do {
            var q =
                new IssueListQuery(
                    query.repo(),
                    query.status(),
                    query.assignee(),
                    query.label(),
                    query.open(),
                    cursor,
                    100);
            var page =
                issues.list(
                    teamId, q, unscheduled, LocalDate.now(clock.withZone(PlanLimits.APP_ZONE)));
            page.items().forEach(i -> ids.add(i.id()));
            cursor = page.nextCursor();
            if (ids.size() > 10000)
              throw new ApiException(400, "VALIDATION_ERROR", "필터를 좁혀 다시 갱신해 주세요");
          } while (cursor != null);
          return List.copyOf(ids);
        });
  }

  @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
  public void requireMember(AuthenticatedUser user, long teamId) {
    access.member(user, teamId);
  }

  public IssueDetailResponse detail(AuthenticatedUser u, long t, long i) {
    return detail.detail(u, t, i);
  }

  public IssueDetailResponse.Candidates candidates(AuthenticatedUser u, long t, long i) {
    return detail.candidates(u, t, i);
  }

  public IssueDetailResponse.LabelOptions labelOptions(AuthenticatedUser u, long t, long i) {
    return detail.labels(u, t, i);
  }

  public IssueDetailResponse.SubIssues subIssues(AuthenticatedUser u, long t, long i) {
    return detail.subIssues(u, t, i);
  }

  public IssueDetailResponse.AssigneesResult assignees(
      AuthenticatedUser u, long t, long i, java.util.List<Long> ids) {
    return detail.assignees(u, t, i, ids);
  }

  public IssueDetailResponse.LabelsResult labels(
      AuthenticatedUser u, long t, long i, java.util.List<String> labels) {
    return detail.labels(u, t, i, labels);
  }

  public IssueDetailResponse.ScheduleResult schedule(
      AuthenticatedUser u, long t, long i, java.time.LocalDate start, java.time.LocalDate due) {
    return detail.schedule(u, t, i, start, due);
  }

  public IssueDetailResponse.StatusResult status(
      AuthenticatedUser u, long t, long i, String value) {
    return detail.status(u, t, i, value);
  }

  public com.linker.backend.dto.issue.response.IssueTemplateResponse.ListResponse templates(
      AuthenticatedUser u, long t, long repo) {
    return templates.list(u, t, repo);
  }

  public com.linker.backend.dto.issue.response.IssueTemplateResponse template(
      AuthenticatedUser u, long t, long repo, String key) {
    return templates.get(u, t, repo, key);
  }

  public com.linker.backend.dto.issue.response.IssueCreateResponse create(
      AuthenticatedUser u, long t, com.linker.backend.dto.issue.request.IssueCreateRequest r) {
    return creation.create(u, t, r);
  }

  public com.linker.backend.dto.issue.response.IssueCreateResponse creationProgress(
      AuthenticatedUser u, long t, long job) {
    return creation.progress(u, t, job);
  }
}
