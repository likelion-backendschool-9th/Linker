package com.linker.backend.global.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.HashMap;
import java.util.Map;

import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.security.AuthenticatedUser;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.socket.WebSocketHandler;

class StompHandshakeInterceptorTest {

	private final StompHandshakeInterceptor interceptor = new StompHandshakeInterceptor();
	private final WebSocketHandler handler = mock(WebSocketHandler.class);
	private final ServerHttpRequest request = mock(ServerHttpRequest.class);

	@AfterEach
	void clearSecurity() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void rejectsGuest() {
		ServerHttpResponse response = mock(ServerHttpResponse.class);
		Map<String, Object> attributes = new HashMap<>();

		boolean accepted = interceptor.beforeHandshake(request, response, handler, attributes);

		assertThat(accepted).isFalse();
		verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
		assertThat(attributes).isEmpty();
	}

	@Test
	void rejectsSuspended() {
		authenticate(user(UserStatus.SUSPENDED));
		ServerHttpResponse response = mock(ServerHttpResponse.class);
		Map<String, Object> attributes = new HashMap<>();

		boolean accepted = interceptor.beforeHandshake(request, response, handler, attributes);

		assertThat(accepted).isFalse();
		verify(response).setStatusCode(HttpStatus.FORBIDDEN);
	}

	@Test
	void storesAuthenticatedUser() {
		AuthenticatedUser user = user(UserStatus.ACTIVE);
		authenticate(user);
		ServerHttpResponse response = mock(ServerHttpResponse.class);
		Map<String, Object> attributes = new HashMap<>();

		boolean accepted = interceptor.beforeHandshake(request, response, handler, attributes);

		assertThat(accepted).isTrue();
		assertThat(attributes.get(StompHandshakeInterceptor.USER_ATTRIBUTE)).isSameAs(user);
	}

	private static AuthenticatedUser user(UserStatus status) {
		return new AuthenticatedUser(
				7L,
				"yunsu",
				UserType.DEVELOPER,
				status,
				null,
				false,
				false,
				false,
				11L
		);
	}

	private static void authenticate(AuthenticatedUser user) {
		SecurityContextHolder.getContext().setAuthentication(
				new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities())
		);
	}
}
