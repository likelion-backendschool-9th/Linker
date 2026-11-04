package com.linker.backend.controller;

import com.linker.backend.service.github.GithubWebhookService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class GithubWebhookController {

	private final GithubWebhookService webhooks;

	public GithubWebhookController(GithubWebhookService webhooks) {
		this.webhooks = webhooks;
	}

	@PostMapping("/webhook/github")
	public ResponseEntity<Void> receive(
			@RequestHeader(value = "X-GitHub-Delivery", required = false) String deliveryId,
			@RequestHeader(value = "X-GitHub-Event", required = false) String event,
			@RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
			@RequestBody byte[] body
	) {
		boolean duplicate = webhooks.accept(deliveryId, event, signature, body);
		return ResponseEntity.status(duplicate ? 200 : 202).build();
	}
}
