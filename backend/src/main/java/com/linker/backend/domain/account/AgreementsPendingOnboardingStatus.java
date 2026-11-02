package com.linker.backend.domain.account;

import org.springframework.stereotype.Component;

@Component
public class AgreementsPendingOnboardingStatus implements OnboardingStatus {

	@Override
	public boolean isOnboarded(long userId) {
		return false;
	}
}
