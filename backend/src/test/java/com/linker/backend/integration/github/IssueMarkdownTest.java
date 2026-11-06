package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.Test;

class IssueMarkdownTest {
  @Test
  void rawHtmlIsEscapedAndUnsafeUrlsRemoved() {
    var value =
        IssueMarkdown.sanitize(
            "<script>alert(1)</script>\n[x](javascript:alert(1))\n![x](data:text/html,test)");
    assertThat(value).doesNotContain("<script>", "javascript:", "data:text");
  }

  @Test
  void markdownAndSafeLinksRemainReadable() {
    assertThat(IssueMarkdown.sanitize("## 제목\n**굵게** [링크](https://example.com)"))
        .contains("## 제목", "**굵게**", "https://example.com");
  }

  @Test
  void nullBodyIsEmpty() {
    assertThat(IssueMarkdown.sanitize(null)).isEmpty();
  }
}
