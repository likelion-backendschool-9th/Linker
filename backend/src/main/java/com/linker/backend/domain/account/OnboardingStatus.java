package com.linker.backend.domain.account;

/**
 * Page 02 owns agreement rows. Until that step replaces this bean, nobody is treated as onboarded.
 */
public interface OnboardingStatus {

	boolean isOnboarded(long userId);
}
