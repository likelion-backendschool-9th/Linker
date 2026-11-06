package com.linker.backend.integration.github;

import java.time.Instant;
import java.util.List;

/** Technical GitHub boundary. Every implementation must reject ambient DB transactions. */
public interface GithubTeamSource {
  record Installation(
      long id, long orgId, String login, String repositorySelection, boolean suspended) {}

  record Organization(
      long id, String nodeId, String login, String avatarUrl, String basePermission) {}

  record Repository(
      long id,
      String owner,
      String name,
      String fullName,
      String description,
      String language,
      int stars,
      int forks,
      String htmlUrl,
      boolean isPrivate,
      boolean isFork,
      String parentFullName,
      String defaultBranch) {}

  record Option(String id, String name) {}

  record Field(String id, String name, String dataType, List<Option> options) {}

  record Project(
      String id, long orgId, int number, String title, int cardCount, List<Field> fields) {}

  record PullRequest(
      long id,
      int number,
      String title,
      String state,
      boolean draft,
      String author,
      String url,
      Instant mergedAt,
      Instant closedAt,
      Instant updatedAt) {}

  Organization organization(long userId, long expectedOrgId, String login);

  Installation installation(long installationId);

  List<Repository> repositories(long userId, long installationId, long expectedOrgId);

  List<Project> projects(long userId, long orgId, String login);

  Project project(long userId, String projectId);

  Project createProject(long userId, String ownerNodeId, String title, String mutationId);

  void updateStatus(long userId, String fieldId, List<String> optionNames);

  void createDateField(long userId, String projectId, String name);

  boolean hasPendingInstallationRequest(long userId);

  List<Long> memberIds(long installationId, String orgLogin, long orgId);

  List<PullRequest> pullRequests(long installationId, Repository repository);
}
