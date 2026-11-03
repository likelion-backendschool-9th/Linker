package com.linker.backend.service.issue;

/** B supplies/refreshed installation read tokens. Never source credentials from event JSON. */
@FunctionalInterface
public interface ProjectsAccessTokenProvider {
	String readToken(long installationId);
}
