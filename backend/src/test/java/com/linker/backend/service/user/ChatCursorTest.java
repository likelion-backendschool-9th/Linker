package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.util.Collections;

import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.realtime.ChatRoomAccess;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.chat.ChatRoomRepositoryCustom.ChatListRow;

import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.transaction.PlatformTransactionManager;

class ChatCursorTest {

	@Test
	void databaseFailureIsNotReportedAsABadCursor() {
		ChatRoomRepository rooms = mock(ChatRoomRepository.class);
		Instant sortAt = Instant.parse("2026-11-01T00:00:00Z");
		ChatListRow row = new ChatListRow(
				4L, "DIRECT", "GENERAL", false, sortAt, "안녕", "VISIBLE", null, sortAt, 1L, null, "상대", "other", null
		);
		when(rooms.listPage(anyLong(), anyString(), org.mockito.ArgumentMatchers.any(Instant.class), nullable(Instant.class), nullable(Long.class), anyInt()))
				.thenReturn(Collections.nCopies(21, row));
		ChatService service = new ChatService(
				new ChatRoomAccess() {
					@Override
					public boolean canSubscribe(long userId, long roomId) {
						return false;
					}

					@Override
					public boolean canSend(long userId, long roomId) {
						return false;
					}
				},
				rooms,
				mock(ChatRoomMemberRepository.class),
				mock(ApplicationEventPublisher.class),
				Clock.systemUTC(),
				null,
				null,
				null,
				mock(PlatformTransactionManager.class),
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				"http://localhost:3000"
		);
		AuthenticatedUser user = new AuthenticatedUser(
				7L, "dev", UserType.DEVELOPER, UserStatus.ACTIVE, null, false, false, true, 1L
		);
		String cursor = service.list(user, "DIRECT", null).nextCursor();
		when(rooms.containedInTab(eq(7L), eq("DIRECT"), eq(4L), org.mockito.ArgumentMatchers.any(Instant.class)))
				.thenThrow(new DataAccessResourceFailureException("down"));

		assertThatThrownBy(() -> service.list(user, "DIRECT", cursor))
				.isInstanceOf(DataAccessResourceFailureException.class);
	}
}
