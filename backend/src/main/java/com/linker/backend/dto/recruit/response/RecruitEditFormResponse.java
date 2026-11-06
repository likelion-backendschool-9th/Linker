package com.linker.backend.dto.recruit.response;

import java.util.List;
import java.util.Map;

public record RecruitEditFormResponse(
		long id,
		String title,
		String intro,
		List<RecruitEditRoleResponse> roles,
		String format,
		String region,
		String goal,
		String duration,
		String deadline,
		List<String> techTags,
		Long teamId,
		String status,
		List<Long> lockedRoleIds,
		Map<String, Integer> minHeadcountByRole
) {
}
