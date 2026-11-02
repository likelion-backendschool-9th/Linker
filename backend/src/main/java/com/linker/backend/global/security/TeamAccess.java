package com.linker.backend.global.security;

/**
 * Team membership checks land with the team step. Until then every check is denied.
 */
public interface TeamAccess {

	boolean hasRole(long userId, long teamId, TeamRole.Level required);
}
