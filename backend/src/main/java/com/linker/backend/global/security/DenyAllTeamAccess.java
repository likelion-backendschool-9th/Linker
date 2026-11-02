package com.linker.backend.global.security;

import org.springframework.stereotype.Component;

@Component
public class DenyAllTeamAccess implements TeamAccess {

	@Override
	public boolean hasRole(long userId, long teamId, TeamRole.Level required) {
		return false;
	}
}
