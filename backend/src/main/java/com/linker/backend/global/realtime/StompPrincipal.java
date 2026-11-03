package com.linker.backend.global.realtime;

import java.security.Principal;

import com.linker.backend.global.security.AuthenticatedUser;

/**
 * STOMP user identity. {@link #getName()} is the Linker user id so {@code /user/queue/**}
 * destinations resolve per account, not per GitHub login.
 */
public record StompPrincipal(AuthenticatedUser user) implements Principal {

	@Override
	public String getName() {
		return Long.toString(user.userId());
	}
}
