package com.linker.backend.global.realtime;

import org.springframework.stereotype.Component;

/**
 * Temporary stand-in until {@code chat_rooms}/{@code chat_room_members} exist.
 * Any signed-in member may hit STOMP chat destinations; membership is enforced later.
 */
@Component
public class AuthenticatedChatRoomAccess implements ChatRoomAccess {

	@Override
	public boolean canParticipate(long userId, long roomId) {
		return userId > 0 && roomId > 0;
	}
}
