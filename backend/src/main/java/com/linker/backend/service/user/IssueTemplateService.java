package com.linker.backend.service.user;

import com.linker.backend.dto.issue.response.*;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.*;
import com.linker.backend.dto.issue.response.IssuePersistenceView.*;
import com.linker.backend.repository.issue.IssueRepository;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service("userIssueTemplateService")
@Transactional(propagation = Propagation.NEVER)
public class IssueTemplateService {
  private final UserIssueAccess access;
  private final IssueRepository issueRepository;
  private final GithubAppClient app;
  private final GithubIssueClient github;
  private final IssueTemplateParser parser;

  public IssueTemplateService(
      UserIssueAccess access,
      IssueRepository issueRepository,
      GithubAppClient app,
      GithubIssueClient github,
      IssueTemplateParser parser) {
    this.access = access;
    this.issueRepository = issueRepository;
    this.app = app;
    this.github = github;
    this.parser = parser;
  }

  public record Selection(Context context, Repo repo) {}

  public Selection select(AuthenticatedUser u, long team, long repo) {
    access.member(u, team);
    var c = issueRepository.context(team);
    return new Selection(
        c,
        c.repos().stream()
            .filter(r -> r.id() == repo)
            .findFirst()
            .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "연결된 저장소를 찾을 수 없어요")));
  }

  private List<IssueTemplateResponse> load(Selection s) {
    String token = app.installationReadToken(s.context().installationId());
    var files = github.templates(s.repo(), token);
    String source = "REPOSITORY";
    if (files.isEmpty()) {
      files = github.organizationTemplates(s.context().orgLogin(), token);
      source = "ORGANIZATION";
    }
    List<IssueTemplateResponse> result = new ArrayList<>();
    for (var file : files)
      try {
        String key =
            (source.equals("REPOSITORY") ? "repo:" : "org:")
                + java.util.Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(file.name().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        result.add(parser.parse(key, file.name(), file.content(), source));
      } catch (RuntimeException ignored) {
        /* malformed templates fall back to defaults */
      }
    for (String key : List.of("bug", "feature", "task")) result.add(builtIn(key, false));
    return List.copyOf(result);
  }

  private IssueTemplateResponse builtIn(String key, boolean fallback) {
    String name =
        switch (key) {
          case "bug" -> "버그 제보";
          case "feature" -> "기능 제안";
          default -> "작업";
        };
    String body =
        switch (key) {
          case "bug" -> "### 어떤 문제가 있나요?\n\n### 재현 방법\n\n### 기대한 동작";
          case "feature" -> "### 필요한 기능\n\n### 해결하려는 문제";
          default -> "### 할 일\n\n### 완료 조건";
        };
    return new IssueTemplateResponse(
        "default:" + key,
        name,
        "",
        "MARKDOWN",
        "DEFAULT",
        "",
        body,
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        "",
        fallback);
  }

  public IssueTemplateResponse get(AuthenticatedUser u, long team, long repo, String key) {
    var s = select(u, team, repo);
    if (key == null || key.isBlank()) return builtIn("task", false);
    var result =
        load(s).stream()
            .filter(t -> t.key().equals(key))
            .findFirst()
            .orElseGet(() -> builtIn("task", true));
    access.member(u, team);
    if (!issueRepository.context(team).equals(s.context()))
      throw new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요");
    return result;
  }

  public List<IssueDetailResponse.Person> candidates(Selection s) {
    String token = app.installationReadToken(s.context().installationId());
    return issueRepository.assigneeCandidates(s.context().teamId()).stream()
        .filter(p -> github.candidateCanRead(s.repo(), p.login(), token))
        .toList();
  }

  public IssueTemplateResponse.ListResponse list(AuthenticatedUser u, long team, long repo) {
    var s = select(u, team, repo);
    var templates = load(s);
    var candidates = candidates(s);
    var labels =
        github.labelOptions(s.repo(), app.installationReadToken(s.context().installationId()));
    access.member(u, team);
    if (!issueRepository.context(team).equals(s.context()))
      throw new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요");
    return new IssueTemplateResponse.ListResponse(
        templates.stream()
            .map(
                t ->
                    new IssueTemplateResponse.Choice(
                        t.key(), t.name(), t.description(), t.format(), t.source()))
            .toList(),
        candidates,
        labels,
        PlanLimits.ISSUE_ASSIGNEES_MAX);
  }
}
