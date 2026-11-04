package com.linker.backend.global.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;

import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.security.AuthenticatedUser;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

class StompChannelInterceptorTest {

	private StompChannelInterceptor interceptor;
	private AuthenticatedUser user;

	@BeforeEach
	void setUp() {
		interceptor = new StompChannelInterceptor((userId, roomId) -> userId == 7L && roomId == 10L);
		user = new AuthenticatedUser(
				7L,
				"yunsu",
				UserType.DEVELOPER,
				UserStatus.ACTIVE,
				null,
				false,
				false,
				false,
				11L
		);
	}

	@Test
	void connectBindsPrincipal() {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
		Map<String, Object> session = new HashMap<>();
		session.put(StompHandshakeInterceptor.USER_ATTRIBUTE, user);
		accessor.setSessionAttributes(session);
		accessor.setSessionId("s1");
		accessor.setLeaveMutable(true);
		Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

		interceptor.preSend(message, null);

		assertThat(accessor.getUser()).isInstanceOf(StompPrincipal.class);
		assertThat(accessor.getUser().getName()).isEqualTo("7");
	}

	@Test
	void connectWithoutUserFails() {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
		accessor.setSessionAttributes(new HashMap<>());
		accessor.setSessionId("s1");
		accessor.setLeaveMutable(true);
		Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

		assertThatThrownBy(() -> interceptor.preSend(message, null))
				.isInstanceOf(StompAuthException.class)
				.hasMessageContaining("로그인");
	}

	@Test
	void subscribeAllowsPersonalQueues() {
		Message<?> message = subscribed("/user/queue/notifications");

		assertThat(interceptor.preSend(message, null)).isSameAs(message);
	}

	@Test
	void subscribeAllowsJoinedRoom() {
		Message<?> message = subscribed("/topic/chat-rooms/10");

		assertThat(interceptor.preSend(message, null)).isSameAs(message);
	}

	@Test
	void subscribeRejectsForeignRoom() {
		Message<?> message = subscribed("/topic/chat-rooms/99");

		assertThatThrownBy(() -> interceptor.preSend(message, null))
				.isInstanceOf(StompAuthException.class)
				.hasMessageContaining("채팅방");
	}

	@Test
	void subscribeRejectsUnknownDestination() {
		Message<?> message = subscribed("/topic/secret");

		assertThatThrownBy(() -> interceptor.preSend(message, null))
				.isInstanceOf(StompAuthException.class)
				.hasMessageContaining("구독");
	}

	@Test
	void sendAllowsJoinedRoom() {
		Message<?> message = sent("/app/chat-rooms/10/messages");

		assertThat(interceptor.preSend(message, null)).isSameAs(message);
	}

	@Test
	void sendRejectsForeignRoom() {
		Message<?> message = sent("/app/chat-rooms/99/messages");

		assertThatThrownBy(() -> interceptor.preSend(message, null))
				.isInstanceOf(StompAuthException.class)
				.hasMessageContaining("채팅방");
	}

	private Message<?> subscribed(String destination) {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
		accessor.setDestination(destination);
		accessor.setSessionId("s1");
		accessor.setSubscriptionId("sub-1");
		accessor.setUser(new StompPrincipal(user));
		accessor.setLeaveMutable(true);
		return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
	}

	private Message<?> sent(String destination) {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
		accessor.setDestination(destination);
		accessor.setSessionId("s1");
		accessor.setUser(new StompPrincipal(user));
		accessor.setLeaveMutable(true);
		return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
	}
}
