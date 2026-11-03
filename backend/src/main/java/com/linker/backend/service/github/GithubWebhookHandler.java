package com.linker.backend.service.github;

import com.linker.backend.entity.github.GithubWebhookDelivery;

public interface GithubWebhookHandler {

	boolean supports(String event);

	void handle(GithubWebhookDelivery delivery);
}
