package com.linker.backend.global.realtime;

import java.util.Map;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import com.linker.backend.dto.chat.response.ChatMessageResponse;
import com.linker.backend.service.user.UserChatService;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.MessageBuilder;
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
		if (event == null) {
			return null;
		}
		String eventName = event.path("event").asText();
		long roomId;
		long messageId;
		if ("MESSAGE".equals(eventName) || "EDIT".equals(eventName) || "DELETE".equals(eventName)) {
			roomId = event.path("message").path("roomId").asLong(0);
			messageId = event.path("message").path("id").asLong(0);
		}
		else if ("READ".equals(eventName)) {
			roomId = event.path("roomId").asLong(0);
			messageId = event.path("messageId").asLong(0);
		}
		else {
			return null;
		}
		Long userId = sessions.userId(accessor.getSessionId());
		if (roomId < 1 || messageId < 1 || userId == null) {
			return null;
		}
		if ("READ".equals(eventName)) {
			return chat.visibleTo(userId, roomId, messageId) ? message : null;
		}
		ChatMessageResponse current = chat.currentTranscript(userId, roomId, messageId);
		if (current == null) {
			return null;
		}
		return replaceTranscript(message, eventName, current);
	}

	private Message<?> replaceTranscript(Message<?> message, String eventName, ChatMessageResponse current) {
		try {
			ObjectNode body = mapper.createObjectNode();
			body.put("event", eventName);
			body.set("message", mapper.valueToTree(current));
			Object payload = message.getPayload();
			Object replaced;
			if (payload instanceof byte[]) {
				replaced = mapper.writeValueAsBytes(body);
			}
			else if (payload instanceof String) {
				replaced = mapper.writeValueAsString(body);
			}
			else {
				replaced = mapper.convertValue(body, Map.class);
			}
			return MessageBuilder.createMessage(replaced, message.getHeaders());
		}
		catch (RuntimeException exception) {
			return null;
		}
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
