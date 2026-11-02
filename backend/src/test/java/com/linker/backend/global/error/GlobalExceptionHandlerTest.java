package com.linker.backend.global.error;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GlobalExceptionHandlerTest {

	private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

	@Test
	void hidesUnexpectedFailureDetails() {
		var response = handler.unexpected(new IllegalStateException("password=secret token=abc"));

		assertThat(response.getStatusCode().value()).isEqualTo(500);
		assertThat(response.getBody()).isNotNull();
		assertThat(response.getBody().code()).isEqualTo("INTERNAL_ERROR");
		assertThat(response.getBody().message()).doesNotContain("secret");
		assertThat(response.getBody().detail()).isNull();
	}
}
