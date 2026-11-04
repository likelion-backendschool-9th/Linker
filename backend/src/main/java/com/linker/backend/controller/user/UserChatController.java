package com.linker.backend.controller.user;

import java.security.Principal;
import java.util.Map;

import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.realtime.StompPrincipal;
import com.linker.backend.service.user.UserChatService;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

/**
 * UserChatController (WBS S09). Common STOMP SEND lands here; REST endpoints are added with pages 16–17.
 */
@Controller
public class UserChatController {

	private final UserChatService chat;

	public UserChatController(UserChatService chat) {
		this.chat = chat;
	}

	@MessageMapping("/chat-rooms/{roomId}/messages")
	public void sendMessage(
			@DestinationVariable long roomId,
			@Payload Map<String, Object> payload,
			Principal principal
	) {
		chat.sendMessage(requireUserId(principal), roomId, payload);
	}

	private long requireUserId(Principal principal) {
		if (principal instanceof StompPrincipal stomp) {
			return stomp.user().userId();
		}
		throw new StompAuthException("로그인이 필요해요");
	}
}
