package com.linker.backend.repository.subscription;

import java.util.List;

public interface SubscriptionRepositoryCustom {

	/**
	 * Serializes subscription activation for one user or team until the surrounding transaction ends,
	 * so two paid orders never both insert a first live row.
	 */
	void lockTarget(String key);

	/**
	 * Teams the user may pay Flex for: ACTIVE or COMPLETED teams where the user is the current owner,
	 * or the billing owner of the team's live Flex while still a member. {@code teamId} null lists all.
	 */
	List<FlexTeam> flexTeams(long userId, Long teamId);

	/** Existing optional-schema fallback. null = current schema/search path; public = Ad's legacy scope. */
	com.linker.backend.dto.subscription.response.SubscriptionSchemaView benefitSchema(String schema);
	boolean subscriptionTableExists();

	/** Preserve each consumer's existing predicate; these are not one newly unified policy. */
	boolean hasProBenefit(long userId, java.time.Instant now, boolean graceAvailable);
	boolean hasFlexBenefit(long teamId, java.time.Instant now);
	/** Full chat history remains available for 30 days after the latest Flex period ends. */
	boolean hasFlexChatHistoryBenefit(long teamId, java.time.Instant graceCutoff);
	boolean hasScoutBenefit(long userId, java.time.Instant now, boolean graceAvailable);

	record FlexTeam(long teamId, String name, long memberCount) {
	}
}
