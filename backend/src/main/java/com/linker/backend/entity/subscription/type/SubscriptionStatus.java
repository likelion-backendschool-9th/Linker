package com.linker.backend.entity.subscription.type;

import java.util.List;

/** ERD enum SubscriptionStatus. */
public enum SubscriptionStatus {
	TRIALING, ACTIVE, PAST_DUE, CANCELED, EXPIRED;

	/** Statuses covered by the one-live-row-per-user/team partial unique index. */
	public static final List<SubscriptionStatus> LIVE = List.of(TRIALING, ACTIVE, PAST_DUE);
}
