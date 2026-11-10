package com.linker.backend.service.user;

import java.time.Clock;

import com.linker.backend.dto.auth.response.MeResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.user.SessionController}.
 * {@code onboarded} follows {@code users.onboarded_at}, copied into the session principal at authentication.
 */
@Service("userSessionService")
public class SessionService {

	private final UserSessionRepository sessions;
	private final UserRepository users;
	private final AccountService accounts;
	private final Clock clock;

	public SessionService(UserSessionRepository sessions, UserRepository users, AccountService accounts, Clock clock) {
		this.sessions = sessions;
		this.users = users;
		this.accounts = accounts;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public MeResponse me(AuthenticatedUser user) {
		accounts.deliverJobSeekingOffNotice(user.userId());
		String avatarUrl = users.findById(user.userId()).map(User::getAvatarUrl).orElse(null);
		return new MeResponse(
				user.userId(),
				user.login(),
				user.userType().name(),
				user.adminRegistered(),
				user.status().name(),
				user.onboarded(),
				user.suspendedUntil(),
				avatarUrl
		);
	}

	/**
	 * Closes the current session row. Same {@code revoked_at} write as {@code AuthService.revoke}.
	 * Push-token deletion stays on the settings client until that API exists.
	 */
	@Transactional
	public void logout(AuthenticatedUser user) {
		sessions.findById(user.sessionId()).ifPresent(session -> session.revoke(clock.instant()));
	}
}
