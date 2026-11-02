package com.linker.backend.global.security;

import com.linker.backend.global.error.ApiException;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

	private CurrentUser() {
	}

	public static AuthenticatedUser require() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		return user;
	}
}
