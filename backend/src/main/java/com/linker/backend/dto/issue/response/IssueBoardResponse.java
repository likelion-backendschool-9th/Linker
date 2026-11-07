package com.linker.backend.dto.issue.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Page 14 status board (WBS 4-8, Page TODO 14). Columns are always the four statuses plus "기타";
 * cards reuse the page 11 list item. Status moves use page 12's status API.
 */
@Schema(requiredProperties = {"canWrite", "writePermissionReason", "columns"})
public record IssueBoardResponse(
    boolean canWrite, @Schema(nullable = true) String writePermissionReason, List<Column> columns) {

  @Schema(
      name = "IssueBoardColumn",
      requiredProperties = {"status", "statusColor", "label", "cards"})
  public record Column(
      @Schema(allowableValues = {"TODO", "IN_PROGRESS", "BLOCKED", "DONE", "OTHER"}) String status,
      @Schema(
              description =
                  "Column color from board_status_mappings for the four statuses; OTHER → GRAY.",
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
      String label,
      List<IssueListResponse.Item> cards) {}
}
