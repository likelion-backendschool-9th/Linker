package com.linker.backend.dto.moderation.response;

import java.time.Instant;
import java.util.List;

import com.linker.backend.dto.moderation.response.ReportCaseListResponse.Person;

public record AppealListResponse(List<AppealView> items) {

	public record AppealView(
			long id,
			String status,
			Person user,
			long caseId,
			String reason,
			Instant createdAt,
			String originalHandler
	) {
	}
}
