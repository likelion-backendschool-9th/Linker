package com.linker.backend.service.user;

import java.util.Map;

import com.linker.backend.global.realtime.ChatRoomAccess;
import com.linker.backend.global.realtime.StompAuthException;

import org.springframework.stereotype.Service;

/**
 * Paired entry for {@link com.linker.backend.controller.user.UserChatController}.
 * Persistence and topic broadcast land with pages 16–17.
 */
@Service
public class UserChatService {

	private final ChatRoomAccess chatRooms;

	public UserChatService(ChatRoomAccess chatRooms) {
		this.chatRooms = chatRooms;
	}

	public void sendMessage(long userId, long roomId, Map<String, Object> payload) {
		if (!chatRooms.canParticipate(userId, roomId)) {
			throw new StompAuthException("채팅방에 참여할 수 없어요");
		}
		if (payload == null || payload.isEmpty()) {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
		throw new StompAuthException("채팅 전송은 아직 준비 중이에요");
	}
}
