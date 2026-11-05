package com.linker.backend.global.realtime;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linker.backend.service.user.UserChatService;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Re-checks the current member and block period for each subscriber of an existing room topic.
 * Subscribe-time authorization is not treated as later visibility.
 */
@Component
public class ChatDeliveryGuard implements ChannelInterceptor {

	private final UserChatService chat;
	private final StompSessionUsers sessions;
	private final ObjectMapper mapper;

	public ChatDeliveryGuard(UserChatService chat, StompSessionUsers sessions, ObjectMapper mapper) {
		this.chat = chat;
		this.sessions = sessions;
		this.mapper = mapper;
	}

	@Override
	public Message<?> preSend(Message<?> message, MessageChannel channel) {
		SimpMessageHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, SimpMessageHeaderAccessor.class);
		if (accessor == null || accessor.getMessageType() != SimpMessageType.MESSAGE) {
			return message;
		}
		String destination = accessor.getDestination();
		if (destination == null || !destination.startsWith("/topic/chat-rooms/")) {
			return message;
		}
		JsonNode event = read(message.getPayload());
		if (event == null || !"MESSAGE".equals(event.path("event").asText())) {
			return null;
		}
		long roomId = event.path("message").path("roomId").asLong(0);
		long messageId = event.path("message").path("id").asLong(0);
		Long userId = sessions.userId(accessor.getSessionId());
		if (roomId < 1 || messageId < 1 || userId == null) {
			return null;
		}
		if (!chat.visibleTo(userId, roomId, messageId)) {
			return null;
		}
		return message;
	}

	private JsonNode read(Object payload) {
		try {
			if (payload instanceof byte[] bytes) {
				return mapper.readTree(bytes);
			}
			if (payload instanceof String text) {
				return mapper.readTree(text);
			}
			if (payload instanceof java.util.Map<?, ?> map) {
				return mapper.valueToTree(map);
			}
		}
		catch (RuntimeException exception) {
			return null;
		}
		return null;
	}
}
