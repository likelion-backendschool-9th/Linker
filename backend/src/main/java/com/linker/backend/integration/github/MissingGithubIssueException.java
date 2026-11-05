package com.linker.backend.integration.github;

/** Issue 404 after repository ID verification succeeded with the same installation token. */
public final class MissingGithubIssueException extends RuntimeException {
  public MissingGithubIssueException() {
    super("Verified repository issue no longer exists at this number");
  }
}
