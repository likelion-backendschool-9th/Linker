package com.linker.backend.integration.github;

import com.linker.backend.entity.github.GithubWebhookDelivery;

public interface GithubWebhookHandler {

	boolean supports(String event);

	/**
	 * Called without an enclosing DB transaction. Finish provider reads before
	 * starting short business write transactions, and make writes idempotent.
	 * Returning normally acknowledges this handler, including an explicitly
	 * classified non-target action; it does not prove that a cache row changed.
	 * Unknown/invalid/unresolved cases must not be silently acknowledged.
	 * All matched handlers must return normally for the delivery to be PROCESSED.
	 */
	void handle(GithubWebhookDelivery delivery);
}
