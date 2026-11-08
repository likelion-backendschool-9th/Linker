package com.linker.backend.global.realtime;

import java.util.Map;

import com.linker.backend.dto.notification.event.NotificationsChanged;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * {@code /user/queue/notifications} (WBS realtime paths, shared with page 18). The frame carries no
 * notification data; the header bell and the list refetch over REST, which applies visibility rules.
 */
@Component
public class NotificationNotifier {

	private final SimpMessagingTemplate template;

	public NotificationNotifier(SimpMessagingTemplate template) {
		this.template = template;
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void publish(NotificationsChanged event) {
		template.convertAndSendToUser(Long.toString(event.userId()), "/queue/notifications", Map.of("event", "UPDATED"));
	}
}
