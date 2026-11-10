package com.linker.backend.dto.issue.request;

import com.linker.backend.global.error.ApiException;
import java.util.Set;

/**
 * Filters follow WBS 4-8. Assignees are GitHub logins, not Linker user IDs. {@code q} is the page
 * 11 search box: a case-insensitive part of the issue title.
 */
public record IssueListQuery(
    Long repo,
    String status,
    String assignee,
    String label,
    String q,
    boolean open,
    String cursor,
    int size) {
  /** Longest search text of the page 11 search box (Policy POL-I-6, web `ISSUE.searchMaxLength`). */
  public static final int MAX_QUERY_LENGTH = 100;

  /** Largest page size; also the placeholder size for the page 14 board, which has no paging. */
  public static final int MAX_SIZE = 100;

  public static final Set<String> STATUSES =
      Set.of("TODO", "IN_PROGRESS", "BLOCKED", "DONE", "OTHER", "NONE");

  /** Filters without a search text (pages 14 and 15, refresh, unscheduled). */
  public IssueListQuery(
      Long repo, String status, String assignee, String label, boolean open, String cursor, int size) {
    this(repo, status, assignee, label, null, open, cursor, size);
  }

  public IssueListQuery {
    status = blankToNull(status);
    assignee = blankToNull(assignee);
    label = blankToNull(label);
    q = blankToNull(q == null ? null : q.strip());
    cursor = blankToNull(cursor);
    if ((repo != null && repo <= 0)
        || (status != null && !STATUSES.contains(status))
        || size < 1
        || size > MAX_SIZE
        || (assignee != null && assignee.length() > 39)
        || (label != null && label.length() > 255)
        || (q != null && q.length() > MAX_QUERY_LENGTH)
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
