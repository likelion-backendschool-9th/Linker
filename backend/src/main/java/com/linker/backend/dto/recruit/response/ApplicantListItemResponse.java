package com.linker.backend.dto.recruit.response;

public record ApplicantListItemResponse(
		long id,
		AuthorBriefResponse applicant,
		long roleId,
		String roleName,
		String status,
		String appliedAt,
		int daysLeft
) {
}
