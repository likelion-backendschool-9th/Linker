package com.linker.backend.dto.account.response;

import java.time.Instant;
import java.util.List;

public record ContributionMonthResponse(String month, List<Day> days, Instant asOf) {

	public record Day(String date, int count) {
	}
}
