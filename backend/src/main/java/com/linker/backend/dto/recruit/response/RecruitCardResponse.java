package com.linker.backend.dto.recruit.response;

import java.util.List;

public record RecruitCardResponse(
		long id,
		String title,
		/** 19 card preview: the whole intro; the list shows its first 200 characters (POL-R-2) */
		String intro,
		AuthorBriefResponse author,
		String format,
		String region,
		String goal,
		String deadline,
		String status,
		List<String> techTags,
		List<RecruitRoleResponse> roles,
		String createdAt
) {
}
