package com.linker.backend.controller.user;

import com.linker.backend.dto.auth.response.MeResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.SessionCookies;
import com.linker.backend.service.user.UserSessionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
public class UserSessionController {

	private final UserSessionService sessions;
	private final SessionCookies cookies;

	public UserSessionController(UserSessionService sessions, SessionCookies cookies) {
		this.sessions = sessions;
		this.cookies = cookies;
	}

	@GetMapping("/me")
	@Tag(name = "p00-common")
	@Operation(operationId = "getMe")
	public ResponseEntity<MeResponse> me(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sessions.me(user));
	}

	@PostMapping("/auth/logout")
	@Tag(name = "p06-settings")
	@Operation(operationId = "logout")
	public ResponseEntity<Void> logout(@AuthenticationPrincipal AuthenticatedUser user) {
		sessions.logout(user);
		return ResponseEntity.noContent()
				.cacheControl(CacheControl.noStore())
				.header(HttpHeaders.SET_COOKIE, cookies.clear())
				.build();
	}
}
