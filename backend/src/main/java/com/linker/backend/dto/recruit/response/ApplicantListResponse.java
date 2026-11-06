package com.linker.backend.dto.recruit.response;

import java.util.List;

public record ApplicantListResponse(
		List<RecruitRoleResponse> roles,
		List<ApplicantListItemResponse> items
) {
}
