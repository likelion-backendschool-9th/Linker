package com.linker.backend.global.realtime;

import java.util.Map;

import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.global.security.AuthenticatedUser;

import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * Cookie session is resolved by {@code SessionAuthenticationFilter} on the {@code /ws} upgrade.
 * Rejects guests and suspended accounts before the STOMP session starts.
 */
@Component
public class StompHandshakeInterceptor implements HandshakeInterceptor {

	static final String USER_ATTRIBUTE = "linker.authenticatedUser";

	@Override
	public boolean beforeHandshake(
			ServerHttpRequest request,
			ServerHttpResponse response,
			WebSocketHandler wsHandler,
			Map<String, Object> attributes
	) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
			response.setStatusCode(HttpStatus.UNAUTHORIZED);
			return false;
		}
		if (user.status() == UserStatus.SUSPENDED || user.status() == UserStatus.DELETED) {
			response.setStatusCode(HttpStatus.FORBIDDEN);
			return false;
		}
		attributes.put(USER_ATTRIBUTE, user);
		return true;
	}

	@Override
	public void afterHandshake(
			ServerHttpRequest request,
			ServerHttpResponse response,
			WebSocketHandler wsHandler,
			Exception exception
	) {
	}
}
