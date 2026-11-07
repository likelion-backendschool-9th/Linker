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

	record FlexTeam(long teamId, String name, long memberCount) {
	}
}
