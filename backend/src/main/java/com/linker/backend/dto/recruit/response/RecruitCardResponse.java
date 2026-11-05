package com.linker.backend.dto.recruit.response;

import java.util.List;

public record RecruitCardResponse(
		long id,
		String title,
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
