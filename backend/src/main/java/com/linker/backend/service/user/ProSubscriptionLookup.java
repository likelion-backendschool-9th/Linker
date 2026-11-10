package com.linker.backend.service.user;

import java.time.Instant;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Existing batched Pro lookup contract; no schema or business SQL in the service. */
@Component("userProSubscriptionLookup")
class ProSubscriptionLookup {
	private final SubscriptionRepository subscriptions;
	ProSubscriptionLookup(SubscriptionRepository subscriptions) { this.subscriptions = subscriptions; }
	@Transactional(readOnly = true)
	Probe probe() {
		var schema = subscriptions.benefitSchema(null);
		return schema.ready() ? new Probe(true, schema.grace()) : new Probe(false, false);
	}
	@Transactional(readOnly = true)
	boolean active(Probe probe, long userId, Instant now) {
		return probe != null && probe.ready() && subscriptions.hasProBenefit(userId, now, probe.grace());
	}
	record Probe(boolean ready, boolean grace) {}
}
