package com.linker.backend.dto.issue.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Schema(requiredProperties = {"items", "nextCursor", "total", "canWrite", "writePermissionReason"})
public record IssueListResponse(
    List<Item> items,
    @Schema(nullable = true) String nextCursor,
    long total,
    boolean canWrite,
    @Schema(nullable = true) String writePermissionReason) {
  @Schema(
      name = "IssueListItem",
      requiredProperties = {
        "id",
        "number",
        "repoId",
        "repoName",
        "title",
        "status",
        "statusColor",
        "state",
        "assignees",
        "labels",
        "startDate",
        "dueDate",
        "overdue",
        "inProject",
        "scheduleSyncFailed",
        "syncStatus",
        "syncedAt"
      })
  public record Item(
      long id,
      int number,
      long repoId,
      String repoName,
      String title,
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
      List<Assignee> assignees,
      List<Label> labels,
      @Schema(nullable = true) LocalDate startDate,
      @Schema(nullable = true) LocalDate dueDate,
      boolean overdue,
      boolean inProject,
      boolean scheduleSyncFailed,
      @Schema(allowableValues = {"SYNCED", "PENDING", "FAILED"}) String syncStatus,
      @Schema(nullable = true) Instant syncedAt) {}

  @Schema(
      name = "IssueAssignee",
      requiredProperties = {"id", "login", "name", "avatarUrl", "inTeam"})
  public record Assignee(
      @Schema(nullable = true) Long id,
      String login,
      String name,
      @Schema(nullable = true) String avatarUrl,
      boolean inTeam) {}

  @Schema(
      name = "IssueLabel",
      requiredProperties = {"name", "color"})
  public record Label(String name, String color) {}
}
