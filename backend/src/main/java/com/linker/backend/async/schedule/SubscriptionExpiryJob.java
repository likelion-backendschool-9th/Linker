package com.linker.backend.async.schedule;

import com.linker.backend.service.user.SubscriptionService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Page 29: mark subscriptions past their paid period EXPIRED (back to free). Benefits already stop at
 * {@code current_period_end}; this keeps the status and the Flex grace end in step.
 */
@Component
public class SubscriptionExpiryJob {

	private static final Logger log = LoggerFactory.getLogger(SubscriptionExpiryJob.class);

	private final SubscriptionService subscriptions;

	public SubscriptionExpiryJob(SubscriptionService subscriptions) {
		this.subscriptions = subscriptions;
	}

	@Scheduled(fixedDelayString = "${linker.subscriptions.expiry-delay-ms:600000}",
			initialDelayString = "${linker.subscriptions.expiry-delay-ms:600000}")
	public void expireLapsed() {
		try {
			int expired = subscriptions.expireLapsed();
			if (expired > 0) {
				log.info("expired {} subscriptions", expired);
			}
		}
		catch (RuntimeException exception) {
			log.warn("subscription expiry failed: {}", exception.getClass().getSimpleName());
		}
	}
}
