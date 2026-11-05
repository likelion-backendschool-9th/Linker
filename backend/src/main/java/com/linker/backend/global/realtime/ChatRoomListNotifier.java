package com.linker.backend.global.realtime;

import java.util.Map;

import com.linker.backend.dto.chat.event.ChatRoomsChanged;

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
}
