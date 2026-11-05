package com.linker.backend.entity.account;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class UserSessionIdleTest {

	@Test
	void operatorSessionClosesAfterThirtyIdleMinutes() {
		User user = User.create("op", UserType.DEVELOPER);
		UserSession session = UserSession.issue(user, "hash", "JUnit", "127.0.0.1", Instant.parse("2026-12-01T00:00:00Z"));
		Instant start = Instant.parse("2026-11-05T00:00:00Z");

		assertThat(session.expireOperatorIfIdle(start, Duration.ofMinutes(30))).isFalse();
		assertThat(session.expireOperatorIfIdle(start.plus(Duration.ofMinutes(31)), Duration.ofMinutes(30))).isTrue();
		assertThat(session.getRevokedAt()).isEqualTo(start.plus(Duration.ofMinutes(31)));
	}
}
