package com.linker.backend.controller.multi;

import com.linker.backend.dto.auth.response.MeResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.SessionCookies;
import com.linker.backend.service.account.OnboardingStatus;
import com.linker.backend.service.auth.SessionService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class AuthController {

	private final OnboardingStatus onboarding;
	private final SessionService sessions;
	private final SessionCookies cookies;

	public AuthController(OnboardingStatus onboarding, SessionService sessions, SessionCookies cookies) {
		this.onboarding = onboarding;
		this.sessions = sessions;
		this.cookies = cookies;
	}

	@GetMapping("/user/me")
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

	@PostMapping("/public/auth/refresh")
	public ResponseEntity<Void> refresh(HttpServletRequest request, HttpServletResponse response) {
		String token = cookies.read(request);
		sessions.extendNow(token);
		response.addHeader(HttpHeaders.SET_COOKIE, cookies.write(token));
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
