package com.linker.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.linker.backend.global.error.ApiException;

import org.junit.jupiter.api.Test;

class PublicLegalServiceTest {

	private final PublicLegalService legal = new PublicLegalService();

	@Test
	void listShowsCurrentVersionsWithoutTheBody() {
		var documents = legal.list();

		assertThat(documents).extracting(document -> document.slug())
				.containsExactly("terms", "privacy", "community", "recruiter-terms");
		assertThat(legal.termsVersion()).isEqualTo("2026-10-01");
		assertThat(documents).allSatisfy(document -> {
			assertThat(document.version()).isEqualTo("2026-10-01");
			assertThat(document.effectiveDate()).isEqualTo("2026-10-01");
			assertThat(document.title()).isNotBlank();
		});
	}

	@Test
	void termsBodyIsMarkdownForTheViewer() {
		var document = legal.document("terms");

		assertThat(document.title()).isEqualTo("이용약관");
		assertThat(document.body()).startsWith("# 이용약관");
		assertThat(document.body()).contains("[커뮤니티 정책](/legal/community)");
		assertThat(document.body()).doesNotContain("title:");
	}

	@Test
	void unknownSlugIsNotFound() {
		assertThatThrownBy(() -> legal.document("nope"))
				.isInstanceOf(ApiException.class)
				.hasMessage("삭제되었거나 볼 수 없는 콘텐츠예요");
	}
}
