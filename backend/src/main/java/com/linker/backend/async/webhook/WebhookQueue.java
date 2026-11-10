package com.linker.backend.async.webhook;

import java.util.Optional;

public interface WebhookQueue {

	void enqueue(long deliveryRowId);

	Optional<Long> poll();
}
