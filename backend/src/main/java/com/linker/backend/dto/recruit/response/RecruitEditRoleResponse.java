package com.linker.backend.dto.recruit.response;

public record RecruitEditRoleResponse(
		long id,
		String role,
		String name,
		int headcount,
		int filled
) {
}
