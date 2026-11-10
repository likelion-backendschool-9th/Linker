package com.linker.backend.integration.github;

import com.linker.backend.entity.github.GithubWebhookDelivery;
import org.springframework.stereotype.Component;

/** GitHub's delivery-health probe has no team/issue side effects. */
@Component
public class GithubPingWebhookHandler implements GithubWebhookHandler {
	@Override
	public boolean supports(String event) { return "ping".equals(event); }

	@Override
	public void handle(GithubWebhookDelivery delivery) {
		// Signature and durable receipt were already verified by ingress.
	}
}
