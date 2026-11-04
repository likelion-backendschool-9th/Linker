package com.linker.backend.controller.user;

import com.linker.backend.dto.auth.response.MeResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.account.OnboardingStatus;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
public class UserSessionController {

	private final OnboardingStatus onboarding;

	public UserSessionController(OnboardingStatus onboarding) {
		this.onboarding = onboarding;
	}

	@GetMapping("/me")
	public ResponseEntity<MeResponse> me(@AuthenticationPrincipal AuthenticatedUser user) {
		MeResponse body = new MeResponse(
				user.userId(),
				user.login(),
				user.userType().name(),
				user.adminRegistered(),
				user.status().name(),
				onboarding.isOnboarded(user.userId()),
				user.suspendedUntil()
		);
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
	}
}
