package com.linker.backend.dto.notification.request;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class NotificationTextTest {

	@Test
	void writesTitleAndBodyAndLeavesOutABlankBody() {
		assertThat(NotificationText.json("지원이 거절됐어요.", "백엔드 모집"))
				.isEqualTo("{\"title\":\"지원이 거절됐어요.\",\"body\":\"백엔드 모집\"}");
		assertThat(NotificationText.json("지원이 거절됐어요.", null)).isEqualTo("{\"title\":\"지원이 거절됐어요.\"}");
		assertThat(NotificationText.json("지원이 거절됐어요.", "  ")).isEqualTo("{\"title\":\"지원이 거절됐어요.\"}");
	}

	@Test
	void previewCollapsesWhitespaceAndCutsAt100Characters() {
		assertThat(NotificationText.preview("  좋은 글\n\n감사합니다  ")).isEqualTo("좋은 글 감사합니다");
		assertThat(NotificationText.preview(" \n ")).isNull();
		assertThat(NotificationText.preview("가".repeat(100))).isEqualTo("가".repeat(100));
		assertThat(NotificationText.preview("😀".repeat(101))).isEqualTo("😀".repeat(100) + "…");
	}
}
