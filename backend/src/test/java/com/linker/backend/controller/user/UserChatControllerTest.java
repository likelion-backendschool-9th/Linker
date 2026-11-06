package com.linker.backend.controller.user;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.util.Map;

import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.realtime.ChatRoomAccess;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.realtime.StompPrincipal;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.service.user.UserChatService;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import static org.mockito.Mockito.mock;

class UserChatControllerTest {

	private final UserChatController controller = new UserChatController(
			new UserChatService(new ChatRoomAccess() {
				@Override
				public boolean canSubscribe(long userId, long roomId) {
					return userId == 7L && roomId == 10L;
				}

				@Override
				public boolean canSend(long userId, long roomId) {
					return userId == 7L && roomId == 10L;
				}
			}, null, null, null, null, Clock.systemUTC(), null, null, null, null, mock(PlatformTransactionManager.class), null, null, null)
	);

	@Test
	void rejectsForeignRoom() {
		assertThatThrownBy(() -> controller.sendMessage(99L, Map.of("body", "hi"), principal()))
				.isInstanceOf(StompAuthException.class)
				.hasMessageContaining("채팅방");
	}

	@Test
	void rejectsEmptyPayload() {
		assertThatThrownBy(() -> controller.sendMessage(10L, Map.of(), principal()))
				.isInstanceOf(StompAuthException.class)
				.hasMessageContaining("메시지");
	}

	@Test
	void rejectsNonTextPayload() {
		assertThatThrownBy(() -> controller.sendMessage(10L, Map.of("body", "hi"), principal()))
				.isInstanceOf(StompAuthException.class)
				.hasMessageContaining("메시지");
	}

	private static StompPrincipal principal() {
		return new StompPrincipal(new AuthenticatedUser(
				7L,
				"yunsu",
				UserType.DEVELOPER,
				UserStatus.ACTIVE,
				null,
				false,
				false,
				false,
				11L
		));
	}
}
