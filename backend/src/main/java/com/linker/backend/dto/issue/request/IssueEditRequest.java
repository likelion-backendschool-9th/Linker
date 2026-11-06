package com.linker.backend.dto.issue.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public final class IssueEditRequest {
  private IssueEditRequest() {}

  @Schema(
      name = "IssueAssigneesRequest",
      requiredProperties = {"userIds"})
  public record Assignees(@NotNull List<@NotNull Long> userIds) {}

  @Schema(
      name = "IssueLabelsRequest",
      requiredProperties = {"labels"})
  public record Labels(@NotNull List<@NotNull String> labels) {}

  @Schema(
      name = "IssueScheduleRequest",
      requiredProperties = {"startDate", "dueDate"},
      description = "PUT replaces both dates; null clears the field")
  public record Schedule(
      @Schema(nullable = true) LocalDate startDate, @Schema(nullable = true) LocalDate dueDate) {}

  @Schema(
      name = "IssueStatusRequest",
      requiredProperties = {"status"})
  public record Status(
      @NotNull @Schema(allowableValues = {"TODO", "IN_PROGRESS", "BLOCKED", "DONE"})
          String status) {}
}
