package com.linker.backend.controller.multi;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.realtime.StompPrincipal;
import com.linker.backend.global.security.AuthenticatedUser;

import org.junit.jupiter.api.Test;

class ChatControllerTest {

	private final ChatController controller = new ChatController((userId, roomId) -> userId == 7L && roomId == 10L);

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
	void scaffoldBlocksPersistenceUntilChatTablesExist() {
		assertThatThrownBy(() -> controller.sendMessage(10L, Map.of("body", "hi"), principal()))
				.isInstanceOf(StompAuthException.class)
				.hasMessageContaining("준비");
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
				11L
		));
	}
}
