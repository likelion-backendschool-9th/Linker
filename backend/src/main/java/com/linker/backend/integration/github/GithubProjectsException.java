package com.linker.backend.integration.github;

/** Safe integration error: never includes GitHub's response body, query variables or credentials. */
public class GithubProjectsException extends RuntimeException {

	public enum Kind { HTTP_ERROR, GRAPHQL_ERROR, INVALID_RESPONSE, TRANSPORT_ERROR }

	private final Kind kind;
	private final int httpStatus;

	public GithubProjectsException(Kind kind, int httpStatus) {
		super("GitHub request failed: " + kind + " (HTTP " + httpStatus + ")");
		this.kind = kind;
		this.httpStatus = httpStatus;
	}

	public Kind kind() { return kind; }
	public int httpStatus() { return httpStatus; }
}
