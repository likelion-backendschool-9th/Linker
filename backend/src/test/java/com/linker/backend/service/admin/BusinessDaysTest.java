package com.linker.backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

class BusinessDaysTest {

	@Test
	void skipsSaturdayAndSunday() {
		ZoneId seoul = ZoneId.of("Asia/Seoul");
		Instant friday = Instant.parse("2026-11-06T00:00:00Z");

		assertThat(BusinessDays.plus(friday, 2, seoul)).isEqualTo(Instant.parse("2026-11-10T00:00:00Z"));
	}
}
