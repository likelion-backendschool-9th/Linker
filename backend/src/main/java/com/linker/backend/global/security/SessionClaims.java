package com.linker.backend.global.security;

import com.linker.backend.entity.account.User;

/**
 * Screen-routing claims carried in the session JWT.
 * {@code adm} is the {@code admins} row, not the operator OTP flag. Spring still checks the session row.
 * {@code onb} stays false until agreement and profile steps exist.
 */
public record SessionClaims(
		String subject,
		String memberType,
		boolean operator,
		boolean onboarded,
		String status
) {

	public static boolean onboarded(User user) {
		return false;
	}

	public static SessionClaims of(User user, boolean adminRegistered) {
		return new SessionClaims(
				Long.toString(user.getId()),
				user.getUserType().name(),
				adminRegistered,
				onboarded(user),
				user.getStatus().name()
		);
	}
}
