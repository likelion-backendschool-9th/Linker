package com.linker.backend.integration.github;

import com.linker.backend.repository.issue.IssueContextRepository.Context;
import com.linker.backend.repository.issue.IssueContextRepository.Repo;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Technical GitHub adapter contract. Tokens stay inside the server. */
public interface IssueSource {
  record Assignee(long githubId, String login) {}

  record Label(String name, String color) {}

  record Issue(
      long githubId,
      String nodeId,
      int number,
      String title,
      String state,
      String authorLogin,
      String url,
      Instant updated,
      Instant closed,
      List<Assignee> assignees,
      List<Label> labels) {}

  record ProjectItem(
      String id,
      String issueNodeId,
      String repoFullName,
      String status,
      LocalDate start,
      LocalDate due,
      boolean archived) {}

  record RepositoryIssues(Repo repo, List<Issue> issues) {}

  record Snapshot(
      List<RepositoryIssues> repositories,
      Map<String, ProjectItem> projectItems,
      java.util.Set<Long> confirmedMissing) {
    public Snapshot(List<RepositoryIssues> repositories, Map<String, ProjectItem> projectItems) {
      this(repositories, projectItems, java.util.Set.of());
    }
  }

  List<Issue> list(Repo repo, String installationToken);

  Issue issue(Repo repo, int number, String installationToken);

  Map<String, ProjectItem> project(Context context, String installationToken);

  boolean canWrite(Repo repo, long userId);

  String addToProject(String boardId, String issueNodeId, long userId);
}
