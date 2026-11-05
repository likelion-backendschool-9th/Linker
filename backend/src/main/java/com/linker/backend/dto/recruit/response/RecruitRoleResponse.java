package com.linker.backend.dto.recruit.response;

public record RecruitRoleResponse(
		long id,
		String role,
		String name,
		int headcount,
		int filled,
		int remaining
) {
}
