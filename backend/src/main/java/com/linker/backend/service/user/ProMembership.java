package com.linker.backend.service.user;

import java.time.Instant;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Existing Pro lookup contract, backed by the shared subscription Repository. */
@Component("userProMembership")
class ProMembership {
	private final SubscriptionRepository subscriptions;
	ProMembership(SubscriptionRepository subscriptions) { this.subscriptions = subscriptions; }
	@Transactional(readOnly = true)
	boolean active(long userId, Instant now) {
		var schema = subscriptions.benefitSchema(null);
		return schema.ready() && subscriptions.hasProBenefit(userId, now, schema.grace());
	}
}
