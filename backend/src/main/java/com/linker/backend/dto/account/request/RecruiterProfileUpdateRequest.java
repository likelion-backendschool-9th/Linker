package com.linker.backend.dto.account.request;

public record RecruiterProfileUpdateRequest(
		String name,
		String company,
		String jobTitle,
		String websiteUrl
) {
}
