package com.linker.backend.dto.issue.request;

import com.linker.backend.global.error.ApiException;
import java.util.Set;

/** Filters follow WBS 4-8. Assignees are GitHub logins, not Linker user IDs. */
public record IssueListQuery(
    Long repo,
    String status,
    String assignee,
    String label,
    boolean open,
    String cursor,
    int size) {
  /** Largest page size; also the placeholder size for the page 14 board, which has no paging. */
  public static final int MAX_SIZE = 100;

  public static final Set<String> STATUSES =
      Set.of("TODO", "IN_PROGRESS", "BLOCKED", "DONE", "OTHER", "NONE");

  public IssueListQuery {
    status = blankToNull(status);
    assignee = blankToNull(assignee);
    label = blankToNull(label);
    cursor = blankToNull(cursor);
    if ((repo != null && repo <= 0)
        || (status != null && !STATUSES.contains(status))
        || size < 1
        || size > MAX_SIZE
        || (assignee != null && assignee.length() > 39)
        || (label != null && label.length() > 255)
        || (cursor != null && cursor.length() > 1024)) {
      throw invalid();
    }
  }

  public static ApiException invalid() {
    return new ApiException(400, "VALIDATION_ERROR", "조회 조건을 확인해 주세요");
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
