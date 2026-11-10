package com.linker.backend.integration.github;

import java.util.List;

/**
 * Technical GitHub boundary for 22 (POL-P-1): the public repos a user owns, forks included.
 * Every implementation must reject ambient DB transactions.
 */
public interface GithubRepoSource {
  /** Public repos owned by {@code login}, read with that user's token. Private repos never appear. */
  List<GithubTeamSource.Repository> ownedPublicRepositories(long userId, String login);
}
