package com.linker.backend.dto.issue.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Schema(
    requiredProperties = {
      "id",
      "teamId",
      "number",
      "repoId",
      "repoName",
      "title",
      "body",
      "status",
      "statusColor",
      "state",
      "assignees",
      "labels",
      "startDate",
      "dueDate",
      "overdue",
      "inProject",
      "author",
      "githubUrl",
      "createdAt",
      "updatedAt",
      "subIssues",
      "canWrite",
      "writePermissionReason",
      "syncFailed",
      "syncStatus",
      "deletedOrMoved",
      "movedToIssueId"
    })
public record IssueDetailResponse(
    long id,
    long teamId,
    int number,
    long repoId,
    String repoName,
    String title,
    String body,
    @Schema(allowableValues = {"TODO", "IN_PROGRESS", "BLOCKED", "DONE", "OTHER", "NONE"})
        String status,
    @Schema(
            description =
                "GitHub Projects Status option color from board_status_mappings. OTHER/NONE → GRAY.",
            allowableValues = {
              "BLUE",
              "GRAY",
              "GREEN",
              "ORANGE",
              "PINK",
              "PURPLE",
              "RED",
              "YELLOW"
            })
        String statusColor,
    @Schema(allowableValues = {"OPEN", "CLOSED"}) String state,
    List<IssueListResponse.Assignee> assignees,
    List<IssueListResponse.Label> labels,
    @Schema(nullable = true) LocalDate startDate,
    @Schema(nullable = true) LocalDate dueDate,
    boolean overdue,
    boolean inProject,
    Person author,
    @Schema(nullable = true) String githubUrl,
    Instant createdAt,
    Instant updatedAt,
    SubIssueCounts subIssues,
    boolean canWrite,
    @Schema(nullable = true) String writePermissionReason,
    boolean syncFailed,
    @Schema(allowableValues = {"SYNCED", "PENDING", "FAILED"}) String syncStatus,
    @Schema(
            nullable = true,
            allowableValues = {"DELETED", "MOVED"})
        String deletedOrMoved,
    @Schema(nullable = true) Long movedToIssueId) {
  @Schema(
      name = "IssueDetailPerson",
      requiredProperties = {"id", "login", "name", "avatarUrl"})
  public record Person(
      @Schema(nullable = true) Long id,
      String login,
      String name,
      @Schema(nullable = true) String avatarUrl) {}

  @Schema(
      name = "IssueSubIssueCounts",
      requiredProperties = {"total", "done"})
  public record SubIssueCounts(int total, int done) {}

  @Schema(
      name = "IssueAssigneeCandidates",
      requiredProperties = {"items", "max"})
  public record Candidates(List<Person> items, int max) {}

  @Schema(
      name = "IssueLabelOptions",
      requiredProperties = {"items"})
  public record LabelOptions(List<IssueListResponse.Label> items) {}

  @Schema(
      name = "IssueSubIssues",
      requiredProperties = {"items", "total", "done"})
  public record SubIssues(List<SubIssue> items, int total, int done) {}

  @Schema(
      name = "IssueSubIssue",
      requiredProperties = {"id", "number", "title", "state", "githubUrl"})
  public record SubIssue(
      @Schema(nullable = true) Long id,
      int number,
      String title,
      @Schema(allowableValues = {"OPEN", "CLOSED"}) String state,
      String githubUrl,
      /** Board status from Linker cache when linked; otherwise null. */
      @Schema(
              nullable = true,
              allowableValues = {"TODO", "IN_PROGRESS", "BLOCKED", "DONE", "OTHER", "NONE"})
          String status,
      /** Same color enum as issue list; OTHER/NONE → GRAY. Null when unlinked. */
      @Schema(
              nullable = true,
              allowableValues = {
                "BLUE",
                "GRAY",
                "GREEN",
                "ORANGE",
                "PINK",
                "PURPLE",
                "RED",
                "YELLOW"
              })
          String statusColor,
      @Schema(nullable = true) LocalDate dueDate,
      /** First assignee display name only (Figma). Null when none. */
      @Schema(nullable = true) String assigneeName) {}

  @Schema(
      name = "IssueAssigneesResult",
      requiredProperties = {"assignees"})
  public record AssigneesResult(List<IssueListResponse.Assignee> assignees) {}

  @Schema(
      name = "IssueLabelsResult",
      requiredProperties = {"labels"})
  public record LabelsResult(List<IssueListResponse.Label> labels) {}

  @Schema(
      name = "IssueScheduleResult",
      requiredProperties = {"startDate", "dueDate"})
  public record ScheduleResult(
      @Schema(nullable = true) LocalDate startDate, @Schema(nullable = true) LocalDate dueDate) {}

  @Schema(
      name = "IssueStatusResult",
      requiredProperties = {"status", "statusColor", "state"})
  public record StatusResult(
      String status,
      @Schema(
              allowableValues = {
                "BLUE",
                "GRAY",
                "GREEN",
                "ORANGE",
                "PINK",
                "PURPLE",
                "RED",
                "YELLOW"
              })
          String statusColor,
      String state) {}
}
