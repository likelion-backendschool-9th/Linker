package com.linker.backend.global.security;

import java.util.Optional;

import com.linker.backend.global.error.ApiException;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

	private CurrentUser() {
	}

	public static AuthenticatedUser require() {
		return optional().orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
	}

	/** Present when a session cookie was accepted on a public or authenticated path. */
	public static Optional<AuthenticatedUser> optional() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
			return Optional.empty();
		}
		return Optional.of(user);
	}
}
