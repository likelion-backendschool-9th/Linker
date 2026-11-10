package com.linker.backend.dto.recruit.response;

import java.util.List;

/**
 * `[Included]` legacy dossier shape. POL-R-3 reviews the public profile (04) instead; message is gone.
 */
public record ApplicationSheetResponse(
		long id,
		String status,
		String appliedAt,
		AuthorBriefResponse applicant,
		List<String> techStack,
		CompletionBriefResponse completion,
		List<?> contributions,
		List<?> posts
) {
}
