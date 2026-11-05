package com.linker.backend.dto.recruit.request;

public record RecruitRoleWriteRequest(
		Long id,
		String role,
		Integer headcount
) {
}
