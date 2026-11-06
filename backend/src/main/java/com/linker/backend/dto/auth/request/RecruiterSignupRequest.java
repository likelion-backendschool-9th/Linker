package com.linker.backend.dto.auth.request;

public record RecruiterSignupRequest(
		String signupToken,
		String password,
		String name,
		String company,
		String jobTitle,
		String websiteUrl,
		Consents consents
) {
	public record Consents(
			Boolean ageConfirmed,
			Boolean termsAccepted,
			Boolean businessTermsAccepted,
			Boolean personalDataAccepted,
			Boolean marketingAccepted
	) {
	}
}
