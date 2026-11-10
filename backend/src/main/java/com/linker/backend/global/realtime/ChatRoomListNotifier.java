package com.linker.backend.global.realtime;

import java.util.HashMap;
import java.util.Map;

import com.linker.backend.dto.chat.event.ChatMessageModerated;
import com.linker.backend.dto.chat.event.ChatMessageReady;
import com.linker.backend.dto.chat.event.ChatReadAdvanced;
import com.linker.backend.dto.chat.event.ChatRoomsChanged;
import com.linker.backend.dto.chat.event.ChatSendAccepted;
import com.linker.backend.dto.chat.event.ChatSendRejected;
import com.linker.backend.dto.chat.event.ChatTranscriptChanged;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ChatRoomListNotifier {

	private final SimpMessagingTemplate template;

	public ChatRoomListNotifier(SimpMessagingTemplate template) {
		this.template = template;
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void publish(ChatRoomsChanged event) {
		template.convertAndSendToUser(
				Long.toString(event.userId()),
				"/queue/chat-rooms",
				Map.of("type", "CHAT_ROOMS_CHANGED", "roomId", event.roomId())
		);
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void publishMessage(ChatMessageReady event) {
		String destination = "/topic/chat-rooms/" + event.roomId();
		Map<String, Object> body = Map.of("event", "MESSAGE", "message", event.message());
		template.convertAndSend(destination, (Object) body);
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void publishTranscript(ChatTranscriptChanged event) {
		String destination = "/topic/chat-rooms/" + event.roomId();
		Map<String, Object> body = Map.of("event", event.event(), "message", event.message());
		template.convertAndSend(destination, (Object) body);
	}

	/**
	 * Only the ids go out here; {@link ChatDeliveryGuard} swaps in each subscriber's current view of the
	 * row (hidden copy, deleted copy, or the restored text) and drops it for anyone who cannot see it.
	 */
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void publishModerated(ChatMessageModerated event) {
		String destination = "/topic/chat-rooms/" + event.roomId();
		Map<String, Object> body = Map.of(
				"event", "EDIT",
				"message", Map.of("id", event.messageId(), "roomId", event.roomId())
		);
		template.convertAndSend(destination, (Object) body);
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void publishRead(ChatReadAdvanced event) {
		String destination = "/topic/chat-rooms/" + event.roomId();
		Map<String, Object> body = Map.of(
				"event", "READ",
				"roomId", event.roomId(),
				"messageId", event.messageId()
		);
		template.convertAndSend(destination, (Object) body);
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void publishAccepted(ChatSendAccepted event) {
		template.convertAndSendToUser(
				Long.toString(event.userId()),
				"/queue/chat-rooms",
				Map.of(
						"type", "CHAT_SEND_ACCEPTED",
						"roomId", event.roomId(),
						"clientMessageId", event.clientMessageId(),
						"messageId", event.messageId()
				)
		);
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void publishRejection(ChatSendRejected event) {
		Map<String, Object> body = new HashMap<>();
		body.put("type", "CHAT_SEND_REJECTED");
		body.put("roomId", event.roomId());
		body.put("clientMessageId", event.clientMessageId());
		body.put("code", event.code());
		body.put("message", event.message());
		body.put("retryable", event.retryable());
		if (event.retryAfterSeconds() != null) {
			body.put("retryAfterSeconds", event.retryAfterSeconds());
		}
		template.convertAndSendToUser(Long.toString(event.userId()), "/queue/chat-rooms", body);
	}
}
