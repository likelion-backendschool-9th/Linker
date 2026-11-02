package com.linker.backend.domain.github;

public interface GithubWebhookHandler {

	boolean supports(String event);

	void handle(GithubWebhookDelivery delivery);
}
