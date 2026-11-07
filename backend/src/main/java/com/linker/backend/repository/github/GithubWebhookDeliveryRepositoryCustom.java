package com.linker.backend.repository.github;

import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public interface GithubWebhookDeliveryRepositoryCustom {
	/**
	 * Serialize a delivery across workers without keeping a DB transaction open during handlers.
	 * Invalid IDs and lock contention skip work; callers retain the existing recovery/retry flow.
	 */
	@Transactional(propagation = Propagation.NEVER)
	void withDispatchLock(long deliveryId, Runnable work);
}
