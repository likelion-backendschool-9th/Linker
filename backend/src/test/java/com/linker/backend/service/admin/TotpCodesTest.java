package com.linker.backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class TotpCodesTest {

	/** RFC 6238 appendix B, SHA1, time 59s. The 8-digit sample 94287082 ends in these 6 digits. */
	@Test
	void rfc6238Sha1VectorAt59Seconds() {
		byte[] secret = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);
		assertThat(TotpCodes.at(secret, 59 / 30)).isEqualTo("287082");
	}

	@Test
	void matchesTheCurrentStepAndRejectsADistantCode() {
		String secret = "JBSWY3DPEHPK3PXP";
		Instant now = Instant.parse("2026-11-06T01:44:00Z");
		assertThat(TotpCodes.matches(secret, TotpCodes.code(secret, now), now)).isTrue();
		assertThat(TotpCodes.matches(secret, "000000", now)).isFalse();
		assertThat(TotpCodes.matches(secret, "12345", now)).isFalse();
	}
}
