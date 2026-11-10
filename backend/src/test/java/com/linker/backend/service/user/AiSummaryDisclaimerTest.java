package com.linker.backend.service.user;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** Keeps the Policy label string from drifting in the reduced AI summary DTO. */
class AiSummaryDisclaimerTest {

	@Test
	void disclaimerMatchesPolicyCopy() {
		assertEquals("AI가 만든 요약이라 틀릴 수 있어요", AiSummaryService.DISCLAIMER);
	}
}
