package com.linker.backend.dto.issue.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;

@Schema(
    requiredProperties = {
      "completion",
      "counts",
      "history",
      "openByAssignee",
      "overdueCount",
      "dueSoonCount"
    })
public record IssueProgressResponse(
    Completion completion,
    Counts counts,
    List<Day> history,
    List<Workload> openByAssignee,
    long overdueCount,
    long dueSoonCount) {
  @Schema(
      name = "IssueProgressCompletion",
      requiredProperties = {"done", "total", "rate"})
  public record Completion(long done, long total, int rate) {}

  @Schema(
      name = "IssueProgressCounts",
      requiredProperties = {"todo", "inProgress", "blocked", "done"})
  public record Counts(long todo, long inProgress, long blocked, long done) {}

  /** Null means no snapshot was collected, not zero work. */
  @Schema(
      name = "IssueProgressDay",
      requiredProperties = {"date", "todo", "inProgress", "blocked", "done"})
  public record Day(
      LocalDate date,
      @Schema(nullable = true) Long todo,
      @Schema(nullable = true) Long inProgress,
      @Schema(nullable = true) Long blocked,
      @Schema(nullable = true) Long done) {}

  @Schema(
      name = "IssueProgressWorkload",
      requiredProperties = {"userId", "login", "openCount"})
  public record Workload(long userId, String login, long openCount) {}
}
