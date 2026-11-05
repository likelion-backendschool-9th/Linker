package com.linker.backend.async.webhook;

import com.linker.backend.integration.github.GithubWebhookService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "linker.webhook", name = "consumer-enabled", havingValue = "true")
public class GithubWebhookConsumer {

	private static final Logger log = LoggerFactory.getLogger(GithubWebhookConsumer.class);

	private final WebhookQueue queue;
	private final GithubWebhookService webhooks;

	public GithubWebhookConsumer(WebhookQueue queue, GithubWebhookService webhooks) {
		this.queue = queue;
		this.webhooks = webhooks;
	}

	@Scheduled(fixedDelay = 1000)
	public void poll() {
		try {
			for (int i = 0; i < 20; i++) {
				var id = queue.poll();
				if (id.isEmpty()) {
					return;
				}
				webhooks.dispatch(id.get());
			}
		}
		catch (RuntimeException exception) {
			log.warn("webhook consumer failed: {}", exception.getClass().getSimpleName());
		}
	}

	@Scheduled(fixedDelayString = "${linker.webhook.recovery-delay-ms:60000}")
	public void recover() {
		try {
			webhooks.recover();
		}
		catch (RuntimeException exception) {
			log.warn("webhook recovery failed: {}", exception.getClass().getSimpleName());
		}
	}
}
