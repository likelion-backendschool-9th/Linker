package com.linker.backend.integration.github;

/**
 * A supplies a server-only GitHub App USER token after decrypt/refresh.
 * This is not a Linker session JWT or an installation token. Implementations
 * must finish persistence transactions before returning to the GitHub caller.
 */
@FunctionalInterface
public interface GithubUserAccessTokenSource {
	String tokenFor(long userId);
}
