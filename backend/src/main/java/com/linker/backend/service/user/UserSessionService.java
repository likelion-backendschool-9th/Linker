package com.linker.backend.service.user;

import com.linker.backend.dto.auth.response.MeResponse;
import com.linker.backend.global.security.AuthenticatedUser;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.user.UserSessionController}.
 * Onboarding stays false until agreements/profile steps land.
 */
@Service
public class UserSessionService {

	@Transactional(readOnly = true)
	public MeResponse me(AuthenticatedUser user) {
		return new MeResponse(
				user.userId(),
				user.login(),
				user.userType().name(),
				user.adminRegistered(),
				user.status().name(),
				false,
				user.suspendedUntil()
		);
	}
}
