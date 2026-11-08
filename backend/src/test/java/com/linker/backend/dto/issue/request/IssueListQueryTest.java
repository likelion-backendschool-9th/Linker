package com.linker.backend.dto.issue.request;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.linker.backend.global.error.ApiException;
import org.junit.jupiter.api.Test;

/** Page 11 search text rules; the list query itself is covered by IssueReadIntegrationTest. */
class IssueListQueryTest {
  @Test
  void searchTextIsTrimmedAndBlankMeansNoSearch() {
    assertThat(new IssueListQuery(null, null, null, null, "  로그인 ", false, null, 20).q())
        .isEqualTo("로그인");
    assertThat(new IssueListQuery(null, null, null, null, "   ", false, null, 20).q()).isNull();
    assertThat(new IssueListQuery(null, null, null, null, false, null, 20).q()).isNull();
  }

  @Test
  void searchTextLongerThanTheLimitIsRejected() {
    String max = "가".repeat(IssueListQuery.MAX_QUERY_LENGTH);
    assertThat(new IssueListQuery(null, null, null, null, max, false, null, 20).q()).isEqualTo(max);
    assertThatThrownBy(
            () -> new IssueListQuery(null, null, null, null, max + "가", false, null, 20))
        .isInstanceOf(ApiException.class);
  }
}
