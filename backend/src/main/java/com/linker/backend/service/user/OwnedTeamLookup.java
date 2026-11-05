package com.linker.backend.service.user;

import java.util.List;

/** Teams the user currently owns. Page 08 creates {@code teams} and {@code team_members}. */
public interface OwnedTeamLookup {

	List<OwnedTeam> ownedBy(long userId);

	record OwnedTeam(long id, String name) {
	}
}
