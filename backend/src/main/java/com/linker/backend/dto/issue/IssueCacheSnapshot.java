package com.linker.backend.dto.issue;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;

/** Internal Issues-source refresh data. Not a REST request and not a Projects snapshot. */
public record IssueCacheSnapshot(long teamId, long repoId, long githubIssueId, String githubNodeId,
		int number, String title, State state, Long authorUserId, String authorLogin,
		String htmlUrl, Instant githubUpdatedAt, Instant closedAt, List<Assignee> assignees, List<Label> labels) {

	public enum State { OPEN, CLOSED }

	public IssueCacheSnapshot {
		positive(teamId); positive(repoId); positive(githubIssueId); positive(number);
		require(githubNodeId); require(title);
		Objects.requireNonNull(state, "state");
		Objects.requireNonNull(githubUpdatedAt, "githubUpdatedAt");
		if (authorUserId != null) positive(authorUserId);
		assignees = List.copyOf(assignees);
		labels = List.copyOf(labels);
		var users = new HashSet<Long>();
		for (Assignee assignee : assignees) {
			if (!users.add(assignee.githubUserId())) throw new IllegalArgumentException("Duplicate assignee");
		}
		var names = new HashSet<String>();
		for (Label label : labels) {
			if (!names.add(label.name())) throw new IllegalArgumentException("Duplicate label");
		}
	}

	public IssueCacheSnapshot withRelations(List<Assignee> users, List<Label> tags) {
		return new IssueCacheSnapshot(teamId, repoId, githubIssueId, githubNodeId, number, title, state,
				authorUserId, authorLogin, htmlUrl, githubUpdatedAt, closedAt, users, tags);
	}

	public record Assignee(long githubUserId, String login, Long userId) {
		public Assignee { positive(githubUserId); require(login); if (userId != null) positive(userId); }
	}

	public record Label(String name, String color) {
		public Label { require(name); require(color); }
	}

	private static void positive(long value) {
		if (value <= 0) throw new IllegalArgumentException("IDs and issue numbers must be positive");
	}
	private static void require(String value) {
		if (value == null || value.isBlank()) throw new IllegalArgumentException("Required issue value is missing");
	}
}
