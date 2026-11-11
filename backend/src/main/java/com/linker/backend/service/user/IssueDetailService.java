package com.linker.backend.service.user;

import com.linker.backend.dto.issue.response.IssueDetailResponse;
import com.linker.backend.dto.issue.response.IssueDetailResponse.AssigneesResult;
import com.linker.backend.dto.issue.response.IssueDetailResponse.Candidates;
import com.linker.backend.dto.issue.response.IssueDetailResponse.LabelOptions;
import com.linker.backend.dto.issue.response.IssueDetailResponse.LabelsResult;
import com.linker.backend.dto.issue.response.IssueDetailResponse.ScheduleResult;
import com.linker.backend.dto.issue.response.IssueDetailResponse.StatusResult;
import com.linker.backend.dto.issue.response.IssueDetailResponse.SubIssue;
import com.linker.backend.dto.issue.response.IssueDetailResponse.SubIssueCounts;
import com.linker.backend.dto.issue.response.IssueDetailResponse.SubIssues;
import com.linker.backend.dto.issue.response.IssueListResponse;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.notification.request.NotificationText;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubAppClient;
import com.linker.backend.integration.github.GithubIssueClient;
import com.linker.backend.integration.github.IssueMarkdown;
import com.linker.backend.integration.github.IssueSource;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Context;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Repo;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Row;
import com.linker.backend.repository.issue.IssueRepository;
import com.linker.backend.repository.issue.IssueSyncJobRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service("userIssueDetailService")
@Transactional(propagation = Propagation.NEVER)
public class IssueDetailService {
  // Operational retry bound, not a product entitlement. Authorization failures are terminal.
  static final int MAX_ATTEMPTS = 3;
  private final UserIssueAccess access;
  private final IssueRepository issueRepository;
  private final IssueSyncJobRepository syncJobs;
  private final GithubIssueClient github;
  private final GithubAppClient app;
  private final NotificationService notifications;
  private final Clock clock;
  private final TransactionTemplate tx;
  private final JsonMapper json = JsonMapper.builder().build();

  public IssueDetailService(
      UserIssueAccess access,
      IssueRepository issueRepository,
      IssueSyncJobRepository syncJobs,
      GithubIssueClient github,
      GithubAppClient app,
      NotificationService notifications,
      Clock clock,
      PlatformTransactionManager manager) {
    this.access = access;
    this.issueRepository = issueRepository;
    this.syncJobs = syncJobs;
    this.github = github;
    this.app = app;
    this.notifications = notifications;
    this.clock = clock;
    this.tx = new TransactionTemplate(manager);
  }

  private record Selected(Context context, Repo repo, Row row) {}

  private Selected select(AuthenticatedUser user, long team, long issue, boolean write) {
    return select(user, team, issue, write, true);
  }

  private Selected select(
      AuthenticatedUser user, long team, long issue, boolean write, boolean requireRepoWrite) {
    access.member(user, team);
    var ctx = issueRepository.context(team);
    var row = issueRepository.detail(team, issue);
    var repo =
        ctx.repos().stream()
            .filter(r -> r.id() == row.repoId())
            .findFirst()
            .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "연결된 이슈를 찾을 수 없어요"));
    if (write) {
      var actor = issueRepository.actor(user.userId());
      if (actor.status() != UserStatus.ACTIVE || actor.userType() != UserType.DEVELOPER)
        throw new ApiException(403, "SUSPENDED", "정지된 계정은 이슈를 변경할 수 없어요");
      if (!ctx.writable() || row.deleted()) throw conflict("읽기 전용이거나 이동·삭제된 이슈예요");
      if (requireRepoWrite && !github.canWrite(repo, user.userId()))
        throw new ApiException(403, "FORBIDDEN", "이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.");
    }
    return new Selected(ctx, repo, row);
  }

  /** Personal repo write, when GitHub can answer. Status moves fall back to the installation token. */
  private boolean userCanWrite(Selected s, AuthenticatedUser user) {
    try {
      return github.canWrite(s.repo, user.userId());
    } catch (ApiException e) {
      return false;
    }
  }

  private record ReadDetail(
      Selected selected, GithubIssueClient.Detail live, String disposition, Long movedToId) {}

  private ReadDetail readDetail(Selected s, String token) {
    var first = github.detail(s.repo, s.row.number(), token);
    if (!"MOVED".equals(first.unavailableState()))
      return new ReadDetail(s, first, first.unavailableState(), null);
    var target = github.movedTarget(s.context, first.location());
    if (target == null) return new ReadDetail(s, first, "MOVED", null);
    var live = github.detail(target.repo(), target.number(), token);
    if (live.issue() == null) return new ReadDetail(s, first, "MOVED", null);
    identity(s, live.issue());
    if (live.issue().number() != target.number()) throw verifying("이동된 이슈 연결을 다시 확인하고 있어요");
    return new ReadDetail(new Selected(s.context, target.repo(), s.row), live, null, s.row.id());
  }

  private ReadDetail openDetail(Selected original, String token) {
    try {
      return readDetail(original, token);
    } catch (ApiException failure) {
      if (failure.getStatus() != 503) throw failure;
      return new ReadDetail(
          original, new GithubIssueClient.Detail(null, "", null, null, null, 0), null, null);
    }
  }

  public IssueDetailResponse detail(AuthenticatedUser user, long team, long issue) {
    return issueRepository.withTeamLock(
        team,
        () -> {
          var original = select(user, team, issue, false);
          String token = app.installationReadToken(original.context.installationId());
          var view = openDetail(original, token);
          var s = view.selected();
          var live = view.live();
          if (live.issue() != null) {
            identity(s, live.issue());
            // A newer cached copy stays. A failed board refresh must not hide the issue.
            if (!live.issue().updated().isBefore(s.row.updated())) {
              try {
                var project = github.project(s.context, token);
                access.member(user, team);
                issueRepository.apply(
                    s.context,
                    new IssueSource.Snapshot(
                        List.of(new IssueSource.RepositoryIssues(s.repo, List.of(live.issue()))),
                        project),
                    false,
                    clock.instant());
              } catch (ApiException ignored) {
                // Saved title, dates, and status still render.
              }
            }
          }
          var row = issueRepository.detail(team, issue);
          boolean canWrite = false;
          String reason = null;
          if (view.disposition() != null || row.deleted()) reason = "ISSUE_UNAVAILABLE";
          else if (!s.context.writable()) reason = "READ_ONLY_TEAM";
          else if (user.status() != UserStatus.ACTIVE) reason = "SUSPENDED";
          else
            try {
              canWrite = github.canWrite(s.repo, user.userId());
              if (!canWrite) reason = "NO_REPOSITORY_WRITE_PERMISSION";
            } catch (ApiException e) {
              reason = "GITHUB_PERMISSION_UNAVAILABLE";
            }
          var children =
              live.unavailableState() == null
                  ? loadSubIssues(user, team, issue)
                  : new SubIssues(List.of(), 0, 0);
          boolean allowed = canWrite;
          String why = reason;
          return tx.execute(
              txStatus -> {
                recheck(user, s);
                String author = row.author() == null ? "" : row.author();
                String boardStatus = row.status();
                return new IssueDetailResponse(
                    row.id(),
                    team,
                    row.number(),
                    row.repoId(),
                    s.repo.fullName(),
                    row.title(),
                    IssueMarkdown.sanitize(live.body()),
                    boardStatus,
                    com.linker.backend.entity.team.type.BoardStatusColors.forStatus(
                            boardStatus, issueRepository.statusColors(team))
                        .name(),
                    row.state(),
                    issueRepository.assignees(team, issue),
                    issueRepository.labels(issue),
                    row.start(),
                    row.due(),
                    row.due() != null
                        && row.due().isBefore(LocalDate.now(clock.withZone(PlanLimits.APP_ZONE)))
                        && !"DONE".equals(boardStatus),
                    row.itemId() != null,
                    issueRepository.author(live.authorGithubId(), author),
                    row.url(),
                    live.created() == null ? row.created() : live.created(),
                    row.updated(),
                    new SubIssueCounts(children.total(), children.done()),
                    allowed,
                    why,
                    "FAILED".equals(row.sync()),
                    row.sync(),
                    view.disposition(),
                    view.movedToId());
              });
        });
  }

  public Candidates candidates(AuthenticatedUser user, long team, long issue) {
    var s = select(user, team, issue, false);
    String token = app.installationReadToken(s.context.installationId());
    var result =
        issueRepository.assigneeCandidates(team).stream()
            .filter(p -> github.candidateCanRead(s.repo, p.login(), token))
            .toList();
    recheck(user, s);
    return new Candidates(result, PlanLimits.ISSUE_ASSIGNEES_MAX);
  }

  public LabelOptions labels(AuthenticatedUser user, long team, long issue) {
    var s = select(user, team, issue, false);
    var result = github.labelOptions(s.repo, app.installationReadToken(s.context.installationId()));
    recheck(user, s);
    return new LabelOptions(
        result.stream().map(l -> new IssueListResponse.Label(l.name(), l.color())).toList());
  }

  public SubIssues subIssues(AuthenticatedUser user, long team, long issue) {
    return issueRepository.withTeamLock(team, () -> loadSubIssues(user, team, issue));
  }

  private SubIssues loadSubIssues(AuthenticatedUser user, long team, long issue) {
    var s = select(user, team, issue, false);
    var result =
        github.subIssues(
            s.repo, s.row.number(), app.installationReadToken(s.context.installationId()));
    recheck(user, s);
    var colors = issueRepository.statusColors(team);
    // Never expose private repository titles/URLs outside this team's connected repositories.
    var visible =
        result.stream()
            .filter(
                i ->
                    s.context.repos().stream()
                        .anyMatch(
                            r ->
                                i.url()
                                    .toLowerCase(java.util.Locale.ROOT)
                                    .startsWith(
                                        ("https://github.com/" + r.fullName() + "/issues/")
                                            .toLowerCase(java.util.Locale.ROOT))))
            .map(i -> toSubIssue(team, i, colors))
            .toList();
    if (result.stream()
        .anyMatch(
            child -> child.githubId() == s.row.githubId() || child.nodeId().equals(s.row.nodeId())))
      throw verifying("하위 이슈 연결을 확인하지 못했어요");
    var summary =
        new SubIssues(
            visible,
            visible.size(),
            (int) visible.stream().filter(i -> "CLOSED".equals(i.state())).count());
    tx.executeWithoutResult(
        status -> {
          recheck(user, s);
          issueRepository.subIssues(team, issue, summary);
        });
    return summary;
  }

  /** Linked → DB status/due/first assignee; unlinked → GitHub first assignee name only. */
  private SubIssue toSubIssue(
      long team,
      IssueSource.Issue source,
      java.util.Map<
              com.linker.backend.entity.team.type.BoardStatus,
              com.linker.backend.entity.team.type.BoardStatusColor>
          colors) {
    Long linked = issueRepository.linkedId(team, source.githubId());
    if (linked != null) {
      Row row = issueRepository.detail(team, linked);
      var people = issueRepository.assignees(team, linked);
      return new SubIssue(
          linked,
          source.number(),
          source.title(),
          source.state(),
          source.url(),
          row.status(),
          com.linker.backend.entity.team.type.BoardStatusColors.forStatus(row.status(), colors)
              .name(),
          row.due(),
          people.isEmpty() ? null : people.getFirst().name());
    }
    String assigneeName = null;
    if (!source.assignees().isEmpty()) {
      var first = source.assignees().getFirst();
      assigneeName = issueRepository.author(first.githubId(), first.login()).name();
    }
    return new SubIssue(
        null,
        source.number(),
        source.title(),
        source.state(),
        source.url(),
        null,
        null,
        null,
        assigneeName);
  }

  public AssigneesResult assignees(AuthenticatedUser user, long team, long issue, List<Long> ids) {
    if (ids == null
        || ids.size() > PlanLimits.ISSUE_ASSIGNEES_MAX
        || ids.stream().anyMatch(i -> i == null || i <= 0)
        || new HashSet<>(ids).size() != ids.size()) throw invalid();
    return change(
        user,
        team,
        issue,
        "SET_ASSIGNEES",
        Map.of("userIds", ids),
        () -> new AssigneesResult(issueRepository.assignees(team, issue)));
  }

  public LabelsResult labels(AuthenticatedUser user, long team, long issue, List<String> labels) {
    if (labels == null
        || labels.stream().anyMatch(l -> l == null || l.isBlank())
        || new HashSet<>(labels).size() != labels.size()) throw invalid();
    return change(
        user,
        team,
        issue,
        "SET_LABELS",
        Map.of("labels", labels),
        () -> new LabelsResult(issueRepository.labels(issue)));
  }

  public ScheduleResult schedule(
      AuthenticatedUser user, long team, long issue, LocalDate start, LocalDate due) {
    if (start != null && due != null && start.isAfter(due)) throw invalid();
    var values = new LinkedHashMap<String, Object>();
    values.put("startDate", start == null ? null : start.toString());
    values.put("dueDate", due == null ? null : due.toString());
    return change(
        user,
        team,
        issue,
        "SET_START",
        values,
        () -> {
          var r = issueRepository.detail(team, issue);
          return new ScheduleResult(r.start(), r.due());
        });
  }

  public StatusResult status(AuthenticatedUser user, long team, long issue, String status) {
    if (status == null || !List.of("TODO", "IN_PROGRESS", "BLOCKED", "DONE").contains(status))
      throw invalid();
    return change(
        user,
        team,
        issue,
        "SET_STATUS",
        Map.of("status", status),
        () -> {
          var r = issueRepository.detail(team, issue);
          return new StatusResult(
              r.status(),
              com.linker.backend.entity.team.type.BoardStatusColors.forStatus(
                      r.status(), issueRepository.statusColors(team))
                  .name(),
              r.state());
        });
  }

  private <T> T change(
      AuthenticatedUser user,
      long team,
      long issue,
      String step,
      Map<String, ?> payload,
      java.util.function.Supplier<T> result) {
    return issueRepository.withTeamLock(
        team,
        () -> {
          var s = select(user, team, issue, true, !"SET_STATUS".equals(step));
          validate(user, s, step, json.valueToTree(payload));
          var durable = new LinkedHashMap<String, Object>(payload);
          durable.put("connection", connection(s));
          if (step.equals("SET_ASSIGNEES"))
            durable.put(
                "previousUserIds",
                issueRepository.assignees(team, issue).stream()
                    .map(IssueListResponse.Assignee::id)
                    .filter(Objects::nonNull)
                    .toList());
          long id =
              tx.execute(
                  status -> {
                    recheck(user, s);
                    return syncJobs.queueEdit(
                        issue,
                        user.userId(),
                        step,
                        json.writeValueAsString(durable),
                        clock.instant());
                  });
          execute(id, user);
          return tx.execute(
              status -> {
                recheck(user, s);
                return result.get();
              });
        });
  }

  private void validate(AuthenticatedUser user, Selected s, String step, JsonNode payload) {
    if (step.equals("SET_ASSIGNEES")) {
      var candidates = candidates(user, s.context.teamId(), s.row.id());
      for (var id : payload.path("userIds"))
        if (candidates.items().stream()
            .noneMatch(person -> person.id() != null && person.id() == id.asLong()))
          throw invalid();
    }
    if (step.equals("SET_LABELS")) {
      var available =
          github
              .labelOptions(s.repo, app.installationReadToken(s.context.installationId()))
              .stream()
              .map(IssueSource.Label::name)
              .collect(java.util.stream.Collectors.toSet());
      for (var label : payload.path("labels"))
        if (!available.contains(label.asString())) throw invalid();
    }
    if (step.equals("SET_STATUS")) option(s.context, payload.path("status").asString());
    if ((step.equals("SET_START") || step.equals("SET_STATUS")) && s.row.itemId() == null)
      throw conflict("먼저 프로젝트에 이슈를 추가해 주세요");
    if (step.equals("SET_START")
        && (s.context.board().startField() == null || s.context.board().dueField() == null))
      throw conflict("프로젝트 날짜 필드 연결이 필요해요");
  }

  private void execute(long id, AuthenticatedUser user) {
    var job = syncJobs.edit(id);
    if ("DONE".equals(job.status()) || "FAILED".equals(job.status())) return;
    if (job.attempts() >= MAX_ATTEMPTS) {
      tx.executeWithoutResult(
          status -> syncJobs.failEdit(id, job.issue(), true, "RETRY_EXHAUSTED", clock.instant()));
      throw new ApiException(
          503,
          "SERVICE_UNAVAILABLE",
          "자동 재시도를 마쳤어요. 동기화 상태를 확인해 주세요",
          Map.of("jobId", id, "syncStatus", "FAILED", "retryScheduled", false));
    }
    tx.executeWithoutResult(status -> syncJobs.startEdit(id, clock.instant().plusSeconds(60)));
    try {
      var s = select(user, job.team(), job.issue(), true, !"SET_STATUS".equals(job.step()));
      var payload = json.readTree(job.payload());
      if (!List.of("SET_ASSIGNEES", "SET_LABELS").contains(job.step()))
        validate(user, s, job.step(), payload);
      if (!connection(s).equals(payload.path("connection").asString()))
        throw conflict("변경 요청 후 팀·보드 연결이 바뀌었어요");
      String token = app.installationReadToken(s.context.installationId());
      var before = github.issue(s.repo, s.row.number(), token);
      identity(s, before);
      var items = github.project(s.context, token);
      var item = items.get(s.row.nodeId());
      if (item != null && item.archived()) throw conflict("보관된 프로젝트 항목은 변경할 수 없어요");
      if ((job.step().equals("SET_START") || job.step().equals("SET_STATUS"))
          && (item == null || !Objects.equals(item.id(), s.row.itemId())))
        throw conflict("프로젝트 연결 정보가 바뀌었어요");
      IssueSource.Issue response = null;
      switch (job.step()) {
        case "SET_ASSIGNEES" -> {
          var candidates = candidates(user, job.team(), job.issue()).items();
          List<String> logins = new ArrayList<>();
          for (var value : payload.path("userIds")) {
            long uid = value.asLong();
            logins.add(
                candidates.stream()
                    .filter(p -> p.id() != null && p.id() == uid)
                    .findFirst()
                    .orElseThrow(IssueDetailService::invalid)
                    .login());
          }
          response =
              github.editIssue(s.repo, s.row.number(), Map.of("assignees", logins), user.userId());
          identity(s, response);
          if (!new HashSet<>(logins)
              .equals(
                  response.assignees().stream()
                      .map(IssueSource.Assignee::login)
                      .collect(java.util.stream.Collectors.toSet())))
            throw conflict("담당자 변경이 GitHub에 반영되지 않았어요");
        }
        case "SET_LABELS" -> {
          List<String> desired = new ArrayList<>();
          payload.path("labels").forEach(v -> desired.add(v.asString()));
          var available =
              github.labelOptions(s.repo, token).stream()
                  .map(IssueSource.Label::name)
                  .collect(java.util.stream.Collectors.toSet());
          if (!available.containsAll(desired)) throw invalid();
          response =
              github.editIssue(s.repo, s.row.number(), Map.of("labels", desired), user.userId());
          identity(s, response);
          if (!new HashSet<>(desired)
              .equals(
                  response.labels().stream()
                      .map(IssueSource.Label::name)
                      .collect(java.util.stream.Collectors.toSet())))
            throw conflict("라벨 변경이 GitHub에 반영되지 않았어요");
        }
        case "SET_START" -> {
          github.projectField(
              s.context,
              item.id(),
              s.context.board().startField(),
              null,
              date(payload, "startDate"),
              user.userId());
          github.projectField(
              s.context,
              item.id(),
              s.context.board().dueField(),
              null,
              date(payload, "dueDate"),
              user.userId());
        }
        case "SET_STATUS" -> {
          String desired = payload.path("status").asString();
          String optionId = option(s.context, desired);
          Map<String, String> state = Map.of("state", desired.equals("DONE") ? "closed" : "open");
          if (userCanWrite(s, user)) {
            github.projectField(
                s.context, item.id(), s.context.board().statusField(), optionId, null, user.userId());
            response = github.editIssue(s.repo, s.row.number(), state, user.userId());
          } else {
            String writeToken = app.installationWriteToken(s.context.installationId());
            github.projectField(
                s.context, item.id(), s.context.board().statusField(), optionId, null, writeToken);
            response = github.editIssue(s.repo, s.row.number(), state, writeToken);
          }
          identity(s, response);
        }
        default -> throw conflict("지원하지 않는 동기화 작업이에요");
      }
      // Fresh source-of-truth reads under the same lock; a write response alone is insufficient.
      var actual = github.issue(s.repo, s.row.number(), token);
      identity(s, actual);
      if (actual.updated().isBefore(s.row.updated())) throw verifying("이슈 최신 내용을 다시 확인하고 있어요");
      var project = github.project(s.context, token);
      var finalItem = project.get(s.row.nodeId());
      if (job.step().equals("SET_START")
          && (finalItem == null
              || !Objects.equals(finalItem.start(), date(payload, "startDate"))
              || !Objects.equals(finalItem.due(), date(payload, "dueDate"))))
        throw verifying("일정이 GitHub에 반영되지 않았어요");
      if (job.step().equals("SET_STATUS")
          && (finalItem == null
              || !finalItem.status().equals(payload.path("status").asString())
              || !actual
                  .state()
                  .equals(payload.path("status").asString().equals("DONE") ? "CLOSED" : "OPEN")))
        throw verifying("상태 변경 결과를 확인하지 못했어요");
      if (response != null
          && job.step().equals("SET_ASSIGNEES")
          && !new HashSet<>(actual.assignees()).equals(new HashSet<>(response.assignees())))
        throw verifying("담당자 변경 결과를 확인하지 못했어요");
      if (response != null
          && job.step().equals("SET_LABELS")
          && !new HashSet<>(actual.labels()).equals(new HashSet<>(response.labels())))
        throw verifying("라벨 변경 결과를 확인하지 못했어요");
      tx.executeWithoutResult(
          status -> {
            recheck(user, s);
            var currentActor = issueRepository.actor(user.userId());
            if (currentActor.status() != UserStatus.ACTIVE
                || currentActor.userType() != UserType.DEVELOPER)
              throw new ApiException(403, "FORBIDDEN", "현재 계정 권한으로 변경을 완료할 수 없어요");
            var previous = new HashSet<Long>();
            payload.path("previousUserIds").forEach(v -> previous.add(v.asLong()));
            issueRepository.apply(
                s.context,
                new IssueSource.Snapshot(
                    List.of(new IssueSource.RepositoryIssues(s.repo, List.of(actual))), project),
                false,
                clock.instant());
            if (job.step().equals("SET_ASSIGNEES"))
              for (var assigned : issueRepository.assignees(job.team(), job.issue()))
                if (assigned.id() != null
                    && assigned.inTeam()
                    && !previous.contains(assigned.id())
                    && assigned.id() != user.userId()) {
                  notifications.create(
                      new CreateNotificationCommand(
                          assigned.id(),
                          NotificationTypes.ISSUE_ASSIGNED,
                          user.userId(),
                          null,
                          null,
                          "/teams/" + job.team() + "/issues/" + job.issue(),
                          NotificationText.json(
                              assignedTitle(user.login()),
                              s.repo.fullName() + " #" + actual.number() + " · " + actual.title()),
                          "issue-assigned:" + job.id() + ":" + assigned.id()));
                }
            syncJobs.finishEdit(id, job.issue());
          });
    } catch (RuntimeException e) {
      // A commit acknowledgement can be lost after DB success. DONE must remain terminal.
      var persisted = syncJobs.edit(id);
      if ("DONE".equals(persisted.status())) return;
      boolean terminal =
          persisted.attempts() >= MAX_ATTEMPTS
              || e instanceof ApiException a && a.getStatus() < 500 && a.getStatus() != 429;
      long retrySeconds = retrySeconds(e, persisted.attempts());
      tx.executeWithoutResult(
          status ->
              syncJobs.failEdit(
                  id,
                  job.issue(),
                  terminal,
                  e instanceof ApiException a ? a.getCode() : "SERVICE_UNAVAILABLE",
                  clock.instant().plusSeconds(retrySeconds)));
      int code = e instanceof ApiException a ? a.getStatus() : 503;
      String key = e instanceof ApiException a ? a.getCode() : "SERVICE_UNAVAILABLE";
      var failure = new LinkedHashMap<String, Object>();
      failure.put("jobId", id);
      failure.put("syncStatus", "FAILED");
      failure.put("retryScheduled", !terminal);
      if (!terminal) failure.put("retryAfterSeconds", retrySeconds);
      throw new ApiException(code, key, "GitHub 반영을 완료하지 못했어요. 동기화 상태를 확인해 주세요", failure);
    }
  }

  public void retryDue() {
    for (long id : syncJobs.dueEdits(clock.instant())) {
      try {
        var job = syncJobs.edit(id);
        issueRepository.withTeamLock(
            job.team(),
            () -> {
              var current = syncJobs.edit(id);
              if (!List.of("PENDING", "RUNNING").contains(current.status())
                  || current.nextRetry().isAfter(clock.instant())) return null;
              var user = issueRepository.actor(current.actor());
              execute(id, user);
              return null;
            });
      } catch (RuntimeException e) {
        org.slf4j.LoggerFactory.getLogger(getClass())
            .warn("Issue edit retry failed for job {} ({})", id, e.getClass().getSimpleName());
      }
    }
  }

  private void recheck(AuthenticatedUser user, Selected selected) {
    access.member(user, selected.context.teamId());
    if (!issueRepository.context(selected.context.teamId()).equals(selected.context))
      throw conflict("팀 연결 정보가 바뀌었어요");
  }

  /** ISSUE_ASSIGNED title; the actor is named by GitHub login, as everywhere on the issue screens. */
  static String assignedTitle(String login) {
    return login == null || login.isBlank()
        ? "이슈에 배정됐어요."
        : login + "님이 회원님을 이슈에 배정했어요.";
  }

  private static void identity(Selected s, IssueSource.Issue issue) {
    if (issue.githubId() != s.row.githubId() || !issue.nodeId().equals(s.row.nodeId()))
      throw conflict("이슈가 이동했거나 연결이 바뀌었어요");
  }

  private static String option(Context ctx, String status) {
    var options =
        ctx.board().statuses().entrySet().stream()
            .filter(e -> e.getValue().equals(status))
            .map(Map.Entry::getKey)
            .toList();
    if (options.size() != 1) throw conflict("프로젝트 상태 매핑을 확인해 주세요");
    return options.getFirst();
  }

  private static String connection(Selected s) {
    var c = s.context;
    return java.util.Arrays.asList(
            c.installationId(),
            c.orgId(),
            c.orgLogin(),
            s.repo.id(),
            s.repo.githubId(),
            s.repo.fullName(),
            c.board().nodeId(),
            c.board().statusField(),
            c.board().startField(),
            c.board().dueField(),
            new java.util.TreeMap<>(c.board().statuses()))
        .toString();
  }

  private static LocalDate date(JsonNode payload, String key) {
    return payload.path(key).isNull() ? null : LocalDate.parse(payload.path(key).asString());
  }

  private static long retrySeconds(RuntimeException error, int attempts) {
    if (error instanceof ApiException api && api.getStatus() == 429) {
      long server =
          api.getDetail() != null && api.getDetail().get("retryAfterSeconds") instanceof Number n
              ? n.longValue()
              : 60;
      return Math.max(60L * (1L << Math.min(attempts - 1, 10)), server);
    }
    return 60;
  }

  private static ApiException verifying(String message) {
    return new ApiException(503, "SERVICE_UNAVAILABLE", message);
  }

  private static ApiException invalid() {
    return new ApiException(400, "VALIDATION_ERROR", "입력한 담당자·라벨·일정을 확인해 주세요");
  }

  private static ApiException conflict(String message) {
    return new ApiException(409, "STATE_CONFLICT", message);
  }
}
