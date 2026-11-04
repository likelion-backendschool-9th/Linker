package com.linker.backend.controller.user;

import java.security.Principal;
import java.util.Map;

import com.linker.backend.global.realtime.ChatRoomAccess;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.realtime.StompPrincipal;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

/**
 * UserChatController (WBS S09). Common STOMP SEND lands here; REST endpoints are added with pages 16–17.
 * Persistence and broadcast come after chat tables exist — this mapping only enforces auth/room access.
 */
@Controller
public class UserChatController {

	private final ChatRoomAccess chatRooms;

	public UserChatController(ChatRoomAccess chatRooms) {
		this.chatRooms = chatRooms;
	}

	@MessageMapping("/chat-rooms/{roomId}/messages")
	public void sendMessage(
			@DestinationVariable long roomId,
			@Payload Map<String, Object> payload,
			Principal principal
	) {
		AuthenticatedSender sender = requireSender(principal);
		if (!chatRooms.canParticipate(sender.userId(), roomId)) {
			throw new StompAuthException("채팅방에 참여할 수 없어요");
		}
		if (payload == null || payload.isEmpty()) {
			throw new StompAuthException("메시지 내용을 확인해 주세요");
		}
		// Chat message persistence + /topic broadcast land with page 17.
		throw new StompAuthException("채팅 전송은 아직 준비 중이에요");
	}

	private AuthenticatedSender requireSender(Principal principal) {
		if (principal instanceof StompPrincipal stomp) {
			return new AuthenticatedSender(stomp.user().userId());
		}
		throw new StompAuthException("로그인이 필요해요");
	}

	private record AuthenticatedSender(long userId) {
	}
}
