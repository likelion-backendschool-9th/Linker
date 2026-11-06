package com.linker.backend.dto.account.response;

public record RecruiterProfileResponse(
		String kind,
		String name,
		String company,
		String jobTitle,
		String websiteUrl,
		String companyEmail
) {
}
