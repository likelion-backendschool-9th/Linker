package com.linker.backend.service.user;

import com.linker.backend.dto.issue.request.IssueCreateRequest;
import com.linker.backend.dto.issue.response.*;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.notification.request.NotificationText;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.*;
import com.linker.backend.repository.issue.*;
import com.linker.backend.service.user.IssueTemplateService.Selection;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@Service("userIssueCreateService")
@Transactional(propagation = Propagation.NEVER)
public class IssueCreateService {
  // Operational safety bounds. Product quota is always PlanLimits.ISSUE_CREATES_PER_DAY.
  private static final int MAX_ATTEMPTS = 3;
  private final IssueTemplateService templates;
  private final UserIssueAccess access;
  private final IssueTemplateParser parser;
  private final IssueRepository issueRepository;
  private final IssueSyncJobRepository syncJobs;
  private final GithubIssueClient github;
  private final GithubAppClient app;
  private final NotificationService notifications;
  private final Clock clock;
  private final TransactionTemplate tx;
  private final JsonMapper json = JsonMapper.builder().build();

  public IssueCreateService(
      IssueTemplateService templates,
      UserIssueAccess access,
      IssueTemplateParser parser,
      IssueRepository issueRepository,
      IssueSyncJobRepository syncJobs,
      GithubIssueClient github,
      GithubAppClient app,
      NotificationService notifications,
      Clock clock,
      PlatformTransactionManager manager) {
    this.templates = templates;
    this.access = access;
    this.parser = parser;
    this.issueRepository = issueRepository;
    this.syncJobs = syncJobs;
    this.github = github;
    this.app = app;
    this.notifications = notifications;
    this.clock = clock;
    this.tx = new TransactionTemplate(manager);
  }

  public IssueCreateResponse create(AuthenticatedUser u, long team, IssueCreateRequest request) {
    access.member(u, team);
    if (request == null
        || request.requestId() == null
        || request.repoId() <= 0
        || request.title() == null
        || request.title().isBlank()) throw invalid();
    return issueRepository.withTeamLock(
        team,
        () -> {
          String hash = requestHash(request);
          var existing = syncJobs.existingCreation(u.userId(), request.requestId());
          if (existing != null) {
            if (existing.team() != team
                || !json.readTree(existing.payload()).path("requestHash").asString().equals(hash))
              throw conflict("같은 작성 요청의 내용이 달라졌어요. 새 작성 요청으로 보내 주세요");
            return response(existing);
          }
          var s = templates.select(u, team, request.repoId());
          writable(u, s);
          var template = templates.get(u, team, request.repoId(), request.templateKey());
          if (template.fallback()
              && request.templateKey() != null
              && !request.templateKey().isBlank())
            throw conflict("템플릿이 바뀌었어요. 기본 템플릿을 확인한 뒤 다시 보내 주세요");
          String body =
              template.format().equals("FORM")
                  ? parser.render(template, request.answers())
                  : request.body() == null ? template.body() : request.body();
          String title = request.title().strip();
          if (title.codePointCount(0, title.length()) > 256
              || body.codePointCount(0, body.length()) > 65000) throw invalid();
          if (request.startDate() != null
              && request.dueDate() != null
              && request.startDate().isAfter(request.dueDate())) throw invalid();
          var candidates = templates.candidates(s);
          List<Long> ids = request.assigneeIds();
          if (ids == null) {
            ids = new ArrayList<>();
            for (String login : template.assignees()) {
              var person =
                  candidates.stream()
                      .filter(p -> p.login().equalsIgnoreCase(login))
                      .findFirst()
                      .orElseThrow(IssueCreateService::invalid);
              ids.add(person.id());
            }
          }
          if (ids.size() > PlanLimits.ISSUE_ASSIGNEES_MAX
              || ids.stream().anyMatch(Objects::isNull)
              || new HashSet<>(ids).size() != ids.size()) throw invalid();
          List<String> logins = new ArrayList<>();
          for (long id : ids)
            logins.add(
                candidates.stream()
                    .filter(p -> p.id() != null && p.id() == id)
                    .findFirst()
                    .orElseThrow(IssueCreateService::invalid)
                    .login());
          List<String> labels = request.labels() == null ? template.labels() : request.labels();
          validateLabels(s, labels);
          String status = request.status() == null ? "TODO" : request.status();
          String option = option(s, status);
          if (request.startDate() != null && s.context().board().startField() == null
              || request.dueDate() != null && s.context().board().dueField() == null)
            throw conflict("프로젝트 날짜 필드 연결이 필요해요");
          github.validateTemplateProjects(s.context(), template.projects(), u.userId());
          ObjectNode payload = json.createObjectNode();
          payload.put("repoId", request.repoId());
          payload.put("requestHash", hash);
          payload.put("connection", connection(s));
          payload.put("title", title);
          payload.put("body", body);
          payload.set("assigneeIds", json.valueToTree(ids));
          payload.set("assignees", json.valueToTree(logins));
          payload.set("labels", json.valueToTree(labels));
          payload.put("type", template.issueType());
          payload.put("phase", "CREATE");
          payload.put("status", status);
          payload.put("option", option);
          payload.put("marker", "<!-- linker-create:" + request.requestId() + " -->");
          if (request.startDate() != null) payload.put("start", request.startDate().toString());
          if (request.dueDate() != null) payload.put("due", request.dueDate().toString());
          long id =
              tx.execute(
                  st -> {
                    recheck(u, s);
                    return syncJobs.queueCreation(
                        team,
                        u.userId(),
                        request.requestId(),
                        json.writeValueAsString(payload),
                        clock.instant());
                  });
          var accepted = syncJobs.creation(id);
          if (accepted.team() != team
              || !json.readTree(accepted.payload()).path("requestHash").asString().equals(hash))
            throw conflict("같은 작성 요청의 내용이 달라졌어요");
          run(id);
          return response(syncJobs.creation(id));
        });
  }

  public IssueCreateResponse progress(AuthenticatedUser u, long team, long id) {
    access.member(u, team);
    var job = syncJobs.creation(id);
    if (job.team() != team) throw new ApiException(404, "NOT_FOUND", "생성 작업을 찾을 수 없어요");
    return response(job);
  }

  private IssueCreateResponse response(IssuePersistenceView.CreationJob job) {
    var p = json.readTree(job.payload());
    boolean retry = job.status().equals("PENDING") || job.status().equals("RUNNING");
    return new IssueCreateResponse(
        job.id(),
        job.status(),
        p.path("phase").asString(),
        job.issue(),
        job.issue() == null ? null : "/teams/" + job.team() + "/issues/" + job.issue(),
        job.error(),
        retry,
        retry ? Math.max(0, Duration.between(clock.instant(), job.retry()).getSeconds()) : null);
  }

  public void retryDue() {
    for (long id : syncJobs.dueCreations(clock.instant()))
      try {
        var j = syncJobs.creation(id);
        issueRepository.withTeamLock(
            j.team(),
            () -> {
              var now = syncJobs.creation(id);
              if (Set.of("PENDING", "RUNNING").contains(now.status())
                  && !now.retry().isAfter(clock.instant())) run(id);
              return null;
            });
      } catch (RuntimeException ignored) {
        /* Current worker retains the lease or the durable retry state. */
      }
  }

  private void run(long id) {
    var job = syncJobs.creation(id);
    if (Set.of("DONE", "FAILED").contains(job.status())) return;
    if (job.attempts() >= MAX_ATTEMPTS) {
      fail(id, true, "RETRY_EXHAUSTED", 60);
      return;
    }
    tx.executeWithoutResult(st -> syncJobs.startCreation(id, clock.instant().plusSeconds(600)));
    ObjectNode p = (ObjectNode) json.readTree(job.payload());
    Long local = job.issue();
    try {
      var u = issueRepository.actor(job.actor());
      var s = templates.select(u, job.team(), p.path("repoId").asLong());
      writable(u, s);
      if (!connection(s).equals(p.path("connection").asString()))
        throw conflict("작성 후 팀·보드 연결이 바뀌었어요");
      // Revalidate live candidates/labels before writes, including retries after a membership
      // change.
      var candidates = templates.candidates(s);
      List<String> logins = new ArrayList<>();
      for (var uid : p.path("assigneeIds"))
        logins.add(
            candidates.stream()
                .filter(person -> person.id() != null && person.id() == uid.asLong())
                .findFirst()
                .orElseThrow(IssueCreateService::invalid)
                .login());
      if (!new HashSet<>(logins).equals(new HashSet<>(strings(p.path("assignees")))))
        throw conflict("담당자 GitHub 계정이 바뀌었어요");
      validateLabels(s, strings(p.path("labels")));
      if (!option(s, p.path("status").asString()).equals(p.path("option").asString()))
        throw conflict("상태 연결이 바뀌었어요");
      String token = app.installationReadToken(s.context().installationId());
      IssueSource.Issue issue;
      if (!p.has("number")) {
        if (p.path("phase").asString().equals("CREATE_SENT")) {
          issue =
              github.createdWithMarker(
                  s.repo(),
                  p.path("marker").asString(),
                  job.created().minusSeconds(60),
                  job.actor());
          if (issue == null) {
            fail(id, true, "CREATE_OUTCOME_UNKNOWN", 60);
            return;
          }
        } else {
          p.put("phase", "CREATE_SENT");
          checkpoint(id, p, null);
          Map<String, Object> fields = new LinkedHashMap<>();
          fields.put("title", p.path("title").asString());
          fields.put("body", p.path("body").asString() + "\n\n" + p.path("marker").asString());
          fields.put("assignees", logins);
          fields.put("labels", strings(p.path("labels")));
          if (!p.path("type").asString().isBlank()) fields.put("type", p.path("type").asString());
          try {
            issue = github.createIssue(s.repo(), fields, job.actor());
          } catch (ApiException rejection) {
            if (rejection.getStatus() == 429) {
              p.put("phase", "CREATE");
              checkpoint(id, p, null);
            }
            throw rejection;
          }
        }
        p.put("number", issue.number());
        p.put("githubId", issue.githubId());
        p.put("nodeId", issue.nodeId());
        p.put("phase", "ADD_TO_PROJECT");
        checkpoint(id, p, null);
      } else issue = github.issue(s.repo(), p.path("number").asInt(), token);
      identity(p, issue);
      if (!issue.authorLogin().equalsIgnoreCase(u.login())) throw conflict("생성 작성자를 확인하지 못했어요");
      github.verifyCreatedContent(
          s.repo(),
          issue.number(),
          p.path("title").asString(),
          p.path("body").asString() + "\n\n" + p.path("marker").asString(),
          p.path("type").asString(),
          token);
      verifyMetadata(p, issue);
      // Cache only a real GitHub issue. No phantom/local-only issue is ever inserted.
      local = store(s, p, issue, github.project(s.context(), token), u, id, false);
      var items = github.project(s.context(), token);
      var item = items.get(issue.nodeId());
      if (item != null && item.archived()) throw conflict("보관된 프로젝트 항목이에요");
      if (item == null) {
        recheck(u, s);
        github.addToProject(s.context().board().nodeId(), issue.nodeId(), u.userId());
        items = github.project(s.context(), token);
        item = items.get(issue.nodeId());
      }
      if (item == null) throw conflict("프로젝트에 추가된 이슈를 확인하지 못했어요");
      String itemId = item.id();
      p.put("phase", "SET_START");
      checkpoint(id, p, local);
      if (p.has("start")) {
        recheck(u, s);
        github.projectField(
            s.context(),
            itemId,
            s.context().board().startField(),
            null,
            LocalDate.parse(p.path("start").asString()),
            u.userId());
      }
      p.put("phase", "SET_DUE");
      checkpoint(id, p, local);
      if (p.has("due")) {
        recheck(u, s);
        github.projectField(
            s.context(),
            itemId,
            s.context().board().dueField(),
            null,
            LocalDate.parse(p.path("due").asString()),
            u.userId());
      }
      p.put("phase", "SET_STATUS");
      checkpoint(id, p, local);
      recheck(u, s);
      github.projectField(
          s.context(),
          itemId,
          s.context().board().statusField(),
          p.path("option").asString(),
          null,
          u.userId());
      boolean done = p.path("status").asString().equals("DONE");
      if (done != issue.state().equals("CLOSED")) {
        recheck(u, s);
        issue =
            github.editIssue(
                s.repo(), issue.number(), Map.of("state", done ? "closed" : "open"), u.userId());
        identity(p, issue);
      }
      p.put("phase", "VERIFY");
      checkpoint(id, p, local);
      issue = github.issue(s.repo(), issue.number(), token);
      identity(p, issue);
      verifyMetadata(p, issue);
      if (done != issue.state().equals("CLOSED")) throw conflict("GitHub 이슈 상태 반영을 확인하지 못했어요");
      items = github.project(s.context(), token);
      item = items.get(issue.nodeId());
      if (item == null
          || item.archived()
          || !item.status().equals(p.path("status").asString())
          || p.has("start")
              && !Objects.equals(item.start(), LocalDate.parse(p.path("start").asString()))
          || p.has("due") && !Objects.equals(item.due(), LocalDate.parse(p.path("due").asString())))
        throw conflict("GitHub 프로젝트 반영을 확인하지 못했어요");
      p.put("phase", "DONE");
      store(s, p, issue, items, u, id, true);
    } catch (RuntimeException e) {
      boolean terminal =
          e instanceof ApiException a
              && a.getStatus() < 500
              && a.getStatus() != 429
              && a.getStatus() != 409;
      long delay = 60L * (job.attempts() + 1);
      if (e instanceof ApiException a
          && a.getDetail() != null
          && a.getDetail().get("retryAfterSeconds") instanceof Number n)
        delay = Math.max(delay, n.longValue());
      fail(
          id,
          terminal || job.attempts() + 1 >= MAX_ATTEMPTS,
          e instanceof ApiException a ? a.getCode() : "SERVICE_UNAVAILABLE",
          Math.min(delay, 315360000L));
    }
  }

  private long store(
      Selection s,
      ObjectNode p,
      IssueSource.Issue issue,
      Map<String, IssueSource.ProjectItem> items,
      AuthenticatedUser u,
      long job,
      boolean finish) {
    return tx.execute(
        st -> {
          recheck(u, s);
          issueRepository.apply(
              s.context(),
              new IssueSource.Snapshot(
                  List.of(new IssueSource.RepositoryIssues(s.repo(), List.of(issue))), items),
              false,
              clock.instant());
          Long id = issueRepository.linkedId(s.context().teamId(), issue.githubId());
          if (id == null) throw conflict("생성된 이슈 연결을 확인하지 못했어요");
          issueRepository.markCreatedViaLinker(id, u.userId(), finish);
          syncJobs.checkpointCreation(job, json.writeValueAsString(p), id);
          if (finish) {
            for (var a : issue.assignees()) {
              var person = issueRepository.assigneeRecipients(s.context().teamId(), a.githubId());
              for (long recipient : person)
                if (recipient != u.userId())
                  notifications.create(
                      new CreateNotificationCommand(
                          recipient,
                          NotificationTypes.ISSUE_ASSIGNED,
                          u.userId(),
                          "ISSUE",
                          id,
                          "/teams/" + s.context().teamId() + "/issues/" + id,
                          NotificationText.json(
                              IssueDetailService.assignedTitle(u.login()),
                              s.repo().fullName() + " #" + issue.number() + " · " + issue.title()),
                          "issue-create:" + job + ":" + recipient));
            }
            syncJobs.finishCreation(job, id);
          }
          return id;
        });
  }

  private void checkpoint(long id, ObjectNode p, Long issue) {
    tx.executeWithoutResult(st -> syncJobs.checkpointCreation(id, json.writeValueAsString(p), issue));
  }

  private void fail(long id, boolean terminal, String code, long seconds) {
    tx.executeWithoutResult(
        st -> syncJobs.failCreation(id, terminal, code, clock.instant().plusSeconds(seconds)));
  }

  private void writable(AuthenticatedUser u, Selection s) {
    if (issueRepository.actor(u.userId()).status() != UserStatus.ACTIVE)
      throw new ApiException(403, "SUSPENDED", "정지된 계정은 이슈를 만들 수 없어요");
    if (!s.context().writable()) throw conflict("읽기 전용 팀이에요");
    if (!github.canWrite(s.repo(), u.userId()))
      throw new ApiException(403, "FORBIDDEN", "이 저장소에 이슈를 작성할 권한이 없어요");
  }

  private void recheck(AuthenticatedUser u, Selection s) {
    access.member(u, s.context().teamId());
    if (issueRepository.actor(u.userId()).status() != UserStatus.ACTIVE)
      throw new ApiException(403, "SUSPENDED", "계정 상태가 바뀌었어요");
    if (!issueRepository.context(s.context().teamId()).equals(s.context())) throw conflict("팀 연결 정보가 바뀌었어요");
  }

  private void validateLabels(Selection s, List<String> labels) {
    if (labels.stream().anyMatch(Objects::isNull) || new HashSet<>(labels).size() != labels.size())
      throw invalid();
    var available =
        github
            .labelOptions(s.repo(), app.installationReadToken(s.context().installationId()))
            .stream()
            .map(IssueSource.Label::name)
            .collect(java.util.stream.Collectors.toSet());
    if (!available.containsAll(labels)) throw invalid();
  }

  private static String option(Selection s, String status) {
    if (s.context().board().statusField() == null || s.context().board().statusField().isBlank())
      throw conflict("프로젝트 상태 필드 연결이 필요해요");
    if (!Set.of("TODO", "IN_PROGRESS", "BLOCKED", "DONE").contains(status)) throw invalid();
    return s.context().board().statuses().entrySet().stream()
        .filter(e -> e.getValue().equals(status))
        .map(Map.Entry::getKey)
        .sorted()
        .findFirst()
        .orElseThrow(() -> conflict("선택한 상태의 GitHub 연결이 필요해요"));
  }

  private static String connection(Selection s) {
    var c = s.context();
    return java.util.Arrays.asList(
            c.teamId(),
            c.installationId(),
            c.orgId(),
            c.orgLogin(),
            c.status(),
            s.repo().id(),
            s.repo().githubId(),
            s.repo().fullName(),
            c.board().nodeId(),
            c.board().statusField(),
            c.board().startField(),
            c.board().dueField(),
            new java.util.TreeMap<>(c.board().statuses()))
        .toString();
  }

  private String requestHash(IssueCreateRequest request) {
    try {
      var node = json.valueToTree(request);
      String stable = canonical(node);
      return java.util.HexFormat.of()
          .formatHex(
              java.security.MessageDigest.getInstance("SHA-256")
                  .digest(stable.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  private String canonical(JsonNode n) {
    if (n.isObject()) {
      var values = new TreeMap<String, String>();
      n.properties().forEach(e -> values.put(e.getKey(), canonical(e.getValue())));
      return json.writeValueAsString(values);
    }
    if (n.isArray()) {
      List<String> values = new ArrayList<>();
      n.forEach(v -> values.add(canonical(v)));
      return json.writeValueAsString(values);
    }
    return n.toString();
  }

  private static List<String> strings(JsonNode n) {
    List<String> result = new ArrayList<>();
    for (var v : n) result.add(v.asString());
    return List.copyOf(result);
  }

  private static void identity(JsonNode p, IssueSource.Issue i) {
    if (i.githubId() != p.path("githubId").asLong()
        || !i.nodeId().equals(p.path("nodeId").asString())
        || i.number() != p.path("number").asInt()) throw conflict("GitHub 이슈 식별자가 바뀌었어요");
  }

  private static void verifyMetadata(JsonNode p, IssueSource.Issue i) {
    if (!new HashSet<>(strings(p.path("assignees")))
            .equals(
                i.assignees().stream()
                    .map(IssueSource.Assignee::login)
                    .collect(java.util.stream.Collectors.toSet()))
        || !new HashSet<>(strings(p.path("labels")))
            .equals(
                i.labels().stream()
                    .map(IssueSource.Label::name)
                    .collect(java.util.stream.Collectors.toSet())))
      throw conflict("GitHub 담당자·라벨 반영을 확인하지 못했어요");
  }

  private static ApiException conflict(String m) {
    return new ApiException(409, "STATE_CONFLICT", m);
  }

  private static ApiException invalid() {
    return new ApiException(400, "VALIDATION_ERROR", "이슈 작성 내용을 확인해 주세요");
  }
}
