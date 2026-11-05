package com.linker.backend.dto.account.request;

public record OnboardingAgreementsRequest(
		boolean ageConfirmed,
		boolean termsAccepted,
		boolean privacyAccepted,
		boolean marketingAccepted,
		String termsVersion
) {
}
