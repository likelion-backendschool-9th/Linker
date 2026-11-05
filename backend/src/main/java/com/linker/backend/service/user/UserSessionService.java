package com.linker.backend.service.user;

import java.time.Clock;

import com.linker.backend.dto.auth.response.MeResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserSessionRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.user.UserSessionController}.
 * {@code onboarded} follows {@code users.onboarded_at}, copied into the session principal at authentication.
 */
@Service
public class UserSessionService {

	private final UserSessionRepository sessions;
	private final Clock clock;

	public UserSessionService(UserSessionRepository sessions, Clock clock) {
		this.sessions = sessions;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public MeResponse me(AuthenticatedUser user) {
		return new MeResponse(
				user.userId(),
				user.login(),
				user.userType().name(),
				user.adminRegistered(),
				user.status().name(),
				user.onboarded(),
				user.suspendedUntil()
		);
	}

	/**
	 * Closes the current session row. Same {@code revoked_at} write as {@code PublicAuthService.revoke}.
	 * Push-token deletion stays on the settings client until that API exists.
	 */
	@Transactional
	public void logout(AuthenticatedUser user) {
		sessions.findById(user.sessionId()).ifPresent(session -> session.revoke(clock.instant()));
	}
}
