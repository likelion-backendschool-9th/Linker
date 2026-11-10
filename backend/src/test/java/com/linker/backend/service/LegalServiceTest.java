package com.linker.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.linker.backend.global.error.ApiException;

import org.junit.jupiter.api.Test;

class LegalServiceTest {

	private final LegalService legal = new LegalService();

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

		assertThat(document.title()).isEqualTo("이용 약관");
		assertThat(document.body()).startsWith("# 이용 약관");
		assertThat(document.body()).contains(
				"## 제1조 (목적)", "## 제17조 (회사의 의무)", "## 제22조 (준거법과 관할)");
		assertThat(document.body()).doesNotContain("title:");
	}

	@Test
	void unknownSlugIsNotFound() {
		assertThatThrownBy(() -> legal.document("nope"))
				.isInstanceOf(ApiException.class)
				.hasMessage("삭제되었거나 볼 수 없는 콘텐츠예요");
	}
}
