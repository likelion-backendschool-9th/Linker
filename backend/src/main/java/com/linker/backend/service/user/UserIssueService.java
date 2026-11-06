package com.linker.backend.service.user;

import com.linker.backend.dto.issue.request.IssueListQuery;
import com.linker.backend.dto.issue.response.IssueDetailResponse;
import com.linker.backend.dto.issue.response.IssueFilterOptionsResponse;
import com.linker.backend.dto.issue.response.IssueListResponse;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.IssueSource;
import com.linker.backend.repository.issue.IssueContextRepository;
import com.linker.backend.repository.issue.IssueReadRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Transactional(propagation = Propagation.NEVER)
public class UserIssueService {
  private final UserIssueAccess access;
  private final UserIssueTemplateService templates;
  private final UserIssueCreateService creation;
  private final UserIssueDetailService detail;
  private final IssueReadRepository issues;
  private final Clock clock;
  private final IssueContextRepository contexts;
  private final IssueSource source;
  private final TransactionTemplate read;

  public UserIssueService(
      UserIssueAccess access,
      UserIssueTemplateService templates,
      UserIssueCreateService creation,
      UserIssueDetailService detail,
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
    boolean canWrite = false;
    String reason = "NO_REPOSITORY_WRITE_PERMISSION";
    if (!context.writable()) reason = "READ_ONLY_TEAM";
    else if (user.status() == UserStatus.SUSPENDED) reason = "SUSPENDED";
    else
      for (var repo : context.repos()) {
        try {
          if (source.canWrite(repo, user.userId())) {
            canWrite = true;
            reason = null;
            break;
          }
        } catch (ApiException e) {
          reason = "GITHUB_PERMISSION_UNAVAILABLE";
        }
      }
    boolean allowed = canWrite;
    String why = reason;
    return read.execute(
        status -> {
          requireMember(user, teamId);
          if (!contexts.get(teamId).equals(context))
            throw new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요");
          var page =
              issues.list(
                  teamId, query, unscheduled, LocalDate.now(clock.withZone(PlanLimits.APP_ZONE)));
          return new IssueListResponse(page.items(), page.nextCursor(), page.total(), allowed, why);
        });
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
