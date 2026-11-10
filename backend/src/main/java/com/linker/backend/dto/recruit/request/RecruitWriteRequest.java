package com.linker.backend.dto.recruit.request;

import java.util.List;

public record RecruitWriteRequest(
		String title,
		String intro,
		List<RecruitRoleWriteRequest> roles,
		String format,
		String region,
		String goal,
		String duration,
		String deadline,
		List<String> techTags,
		Long teamId
) {
}
