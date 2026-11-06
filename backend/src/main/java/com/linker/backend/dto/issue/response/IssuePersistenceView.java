package com.linker.backend.dto.issue.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Internal issue repository projections shared by C's services and GitHub adapters. Not an HTTP
 * response contract. Context equality is the "team connection unchanged" check, so keep fields.
 */
public final class IssuePersistenceView {
  private IssuePersistenceView() {}

  public record Repo(long id, long githubId, String owner, String name) {
    public String fullName() {
      return owner + "/" + name;
    }
  }

  public record Board(
      String nodeId,
      String statusField,
      String startField,
      String dueField,
      Map<String, String> statuses) {}

  /** installationId is the external GitHub installation ID, not github_installations.id. */
  public record Context(
      long teamId,
      long installationId,
      long orgId,
      String orgLogin,
      String status,
      Board board,
      List<Repo> repos) {
    public boolean writable() {
      return "ACTIVE".equals(status) || "COMPLETED".equals(status);
    }
  }

  public record Cached(
      long id, long repoId, long githubId, String nodeId, int number, String itemId) {}

  public record Row(
      long id,
      long repoId,
      long githubId,
      String nodeId,
      int number,
      String itemId,
      String title,
      String state,
      String status,
      LocalDate start,
      LocalDate due,
      String author,
      String url,
      Instant created,
      Instant updated,
      String sync,
      boolean deleted) {}

  public record EditJob(
      long id,
      long team,
      long issue,
      long actor,
      String step,
      String payload,
      String status,
      int attempts,
      Instant nextRetry) {}

  public record CreationJob(
      long id,
      long team,
      long actor,
      Long issue,
      String payload,
      String status,
      int attempts,
      Instant retry,
      Instant created,
      String error) {}

  public record Reminder(
      long issue,
      long team,
      long repo,
      int number,
      String title,
      LocalDate due,
      long user,
      String login) {}
}
