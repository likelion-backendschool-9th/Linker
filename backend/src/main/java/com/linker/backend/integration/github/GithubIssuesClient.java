package com.linker.backend.integration.github;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import com.linker.backend.dto.issue.IssueCacheSnapshot;
import com.linker.backend.dto.issue.ProjectsRefreshContext;
import tools.jackson.databind.JsonNode;

import static com.linker.backend.integration.github.GithubGraphqlClient.array;
import static com.linker.backend.integration.github.GithubGraphqlClient.invalid;
import static com.linker.backend.integration.github.GithubGraphqlClient.text;

/** Fetch complete relations before replacement; reject partial/inconsistent pages. Read token comes from B. */
public class GithubIssuesClient {

	private final GithubGraphqlClient graphql;
	public GithubIssuesClient(GithubGraphqlClient graphql) { this.graphql = graphql; }

	public IssueCacheSnapshot snapshot(String token, ProjectsRefreshContext context, String issueId) {
		List<IssueCacheSnapshot.Assignee> assignees = new ArrayList<>();
		List<IssueCacheSnapshot.Label> labels = new ArrayList<>();
		Set<String> userCursors = new HashSet<>(), labelCursors = new HashSet<>();
		String userCursor = null, labelCursor = null;
		boolean usersPending = true, labelsPending = true;
		JsonNode first = null;
		do {
			Map<String, Object> variables = variables(issueId, null);
			variables.remove("after");
			variables.put("usersAfter", userCursor); variables.put("labelsAfter", labelCursor);
			variables.put("usersPending", usersPending); variables.put("labelsPending", labelsPending);
			JsonNode node = graphql.execute(token, """
					query($issue: ID!, $usersAfter: String, $labelsAfter: String, $usersPending: Boolean!, $labelsPending: Boolean!) {
					  node(id: $issue) { ... on Issue {
					    id fullDatabaseId number title state updatedAt closedAt url author { login } repository { id }
					    assignees(first: 100, after: $usersAfter) @include(if: $usersPending) {
					      nodes { databaseId login } pageInfo { hasNextPage endCursor }
					    }
					    labels(first: 100, after: $labelsAfter) @include(if: $labelsPending) {
					      nodes { name color } pageInfo { hasNextPage endCursor }
					    }
					  } }
					}
					""", variables).path("node");
			verifyIssue(node, issueId, context.repositoryNodeId());
			if (first == null) first = node;
			else if (!text(first, "updatedAt").equals(text(node, "updatedAt"))) throw invalid();
			if (usersPending) {
				JsonNode connection = node.path("assignees");
				for (JsonNode user : array(connection, "nodes")) assignees.add(new IssueCacheSnapshot.Assignee(positive(user, "databaseId"), text(user, "login"), null));
				userCursor = next(connection, userCursors); usersPending = userCursor != null;
			}
			if (labelsPending) {
				JsonNode connection = node.path("labels");
				for (JsonNode label : array(connection, "nodes")) labels.add(new IssueCacheSnapshot.Label(text(label, "name"), text(label, "color")));
				labelCursor = next(connection, labelCursors); labelsPending = labelCursor != null;
			}
		} while (usersPending || labelsPending);
		try {
			long number = positive(first, "number");
			if (number > Integer.MAX_VALUE) throw invalid();
			return new IssueCacheSnapshot(context.teamId(), context.repoId(), positive(first, "fullDatabaseId"), issueId,
					(int) number, text(first, "title"), IssueCacheSnapshot.State.valueOf(text(first, "state")), null,
					first.path("author").path("login").isString() ? first.path("author").path("login").stringValue() : null,
					text(first, "url"), Instant.parse(text(first, "updatedAt")),
					first.path("closedAt").isNull() ? null : Instant.parse(text(first, "closedAt")), assignees, labels);
		} catch (IllegalArgumentException exception) { throw invalid(); }
	}

	/** Re-resolve current membership; delayed deletion/archive events must not remove a re-added item. */
	public Optional<String> currentProjectItem(String token, ProjectsRefreshContext context, String issueId) {
		Set<String> cursors = new HashSet<>();
		String cursor = null, found = null;
		do {
			JsonNode node = graphql.execute(token, """
					query($issue: ID!, $after: String) {
					  node(id: $issue) { ... on Issue { id repository { id }
					    projectItems(first: 100, after: $after, includeArchived: false) {
					      nodes { id isArchived project { id } } pageInfo { hasNextPage endCursor }
					    }
					  } }
					}
					""", variables(issueId, cursor)).path("node");
			verifyIssue(node, issueId, context.repositoryNodeId());
			JsonNode connection = node.path("projectItems");
			for (JsonNode item : array(connection, "nodes")) {
				if (!item.path("isArchived").isBoolean()) throw invalid();
				if (context.projectId().equals(text(item.path("project"), "id")) && !item.path("isArchived").booleanValue()) {
					if (found != null) throw invalid();
					found = text(item, "id");
				}
			}
			cursor = next(connection, cursors);
		} while (cursor != null);
		return Optional.ofNullable(found);
	}

	private static void verifyIssue(JsonNode node, String issueId, String repoId) {
		if (!issueId.equals(text(node, "id")) || !repoId.equals(text(node.path("repository"), "id"))) throw invalid();
	}

	private static String next(JsonNode connection, Set<String> seen) {
		JsonNode page = connection.path("pageInfo");
		if (!page.path("hasNextPage").isBoolean()) throw invalid();
		if (!page.path("hasNextPage").booleanValue()) return null;
		String cursor = text(page, "endCursor");
		if (!seen.add(cursor)) throw invalid();
		return cursor;
	}

	private static long positive(JsonNode node, String name) {
		JsonNode value = node.path(name);
		try {
			long number = Long.parseLong(value.isIntegralNumber() ? value.toString() : text(node, name));
			if (number <= 0) throw invalid();
			return number;
		} catch (NumberFormatException exception) { throw invalid(); }
	}

	private static Map<String, Object> variables(String issue, String after) {
		if (issue == null || issue.isBlank()) throw new IllegalArgumentException("Issue node ID is required");
		Map<String, Object> result = new LinkedHashMap<>(); result.put("issue", issue); result.put("after", after); return result;
	}
}
