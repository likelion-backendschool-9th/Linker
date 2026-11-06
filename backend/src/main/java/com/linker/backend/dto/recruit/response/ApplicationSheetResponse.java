package com.linker.backend.dto.recruit.response;

import java.util.List;

public record ApplicationSheetResponse(
		long id,
		String status,
		String message,
		String appliedAt,
		AuthorBriefResponse applicant,
		List<String> techStack,
		CompletionBriefResponse completion,
		List<?> contributions,
		List<?> posts
) {
}
