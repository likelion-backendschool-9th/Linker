package com.linker.backend.integration.github;

import java.time.LocalDate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import tools.jackson.databind.JsonNode;

import org.springframework.web.client.RestClient;


/**
 * Projects v2 adapter. B supplies the correct installation/user token for each call.
 * Runtime wiring is opt-in; no auto-created boards, stored credentials or automatic write retries.
 * IDs here are opaque GitHub GraphQL IDs, never Linker database IDs.
 */
public class GithubProjectsClient {

	private static final String FIELD_SELECTION = """
			__typename
			... on ProjectV2Field { id name dataType }
			... on ProjectV2SingleSelectField { id name dataType options { id name } }
			... on ProjectV2IterationField { id name dataType }
			... on ProjectV2MultiSelectField { id name dataType }
			""";

	private final GithubGraphqlClient graphql;

	public GithubProjectsClient(String baseUrl, RestClient.Builder builder) {
		this(new GithubGraphqlClient(baseUrl, builder));
	}

	public GithubProjectsClient(GithubGraphqlClient graphql) { this.graphql = Objects.requireNonNull(graphql); }

	public Project createProject(String token, String organizationNodeId, String title) {
		JsonNode node = post(token, """
				mutation($owner: ID!, $title: String!) {
				  createProjectV2(input: {ownerId: $owner, title: $title}) {
				    projectV2 { id number title }
				  }
				}
				""", Map.of("owner", require(organizationNodeId, "organizationNodeId"), "title", require(title, "title")))
				.path("createProjectV2").path("projectV2");
		if (!node.path("number").isIntegralNumber() || node.path("number").intValue() <= 0) throw invalid();
		return new Project(text(node, "id"), node.path("number").intValue(), text(node, "title"));
	}

	public List<Field> fields(String token, String projectId) {
		require(projectId, "projectId");
		List<Field> result = new ArrayList<>();
		Set<String> cursors = new HashSet<>();
		String cursor = null;
		do {
			Map<String, Object> variables = new LinkedHashMap<>();
			variables.put("project", projectId);
			variables.put("after", cursor);
			JsonNode connection = post(token, """
					query($project: ID!, $after: String) {
					  node(id: $project) { ... on ProjectV2 {
					    fields(first: 100, after: $after) { nodes { %s } pageInfo { hasNextPage endCursor } }
					  } }
					}
					""".formatted(FIELD_SELECTION), variables).path("node").path("fields");
			for (JsonNode node : array(connection, "nodes")) result.add(field(node));
			cursor = nextCursor(connection, cursors);
		} while (cursor != null);
		return List.copyOf(result);
	}

	public Field createDateField(String token, String projectId, String name) {
		JsonNode node = post(token, """
				mutation($project: ID!, $name: String!) {
				  createProjectV2Field(input: {projectId: $project, name: $name, dataType: DATE}) {
				    projectV2Field { ... on ProjectV2Field { id name dataType } }
				  }
				}
				""", Map.of("project", require(projectId, "projectId"), "name", require(name, "name")))
				.path("createProjectV2Field").path("projectV2Field");
		Field field = field(node);
		if (!"DATE".equals(field.dataType())) throw invalid();
		return field;
	}

	public String addIssue(String token, String projectId, String issueNodeId) {
		return text(post(token, """
				mutation($project: ID!, $issue: ID!) {
				  addProjectV2ItemById(input: {projectId: $project, contentId: $issue}) { item { id } }
				}
				""", Map.of("project", require(projectId, "projectId"), "issue", require(issueNodeId, "issueNodeId")))
				.path("addProjectV2ItemById").path("item"), "id");
	}

	public String setDate(String token, String projectId, String itemId, String fieldId, LocalDate date) {
		return updateField(token, projectId, itemId, fieldId, Map.of("date", Objects.requireNonNull(date, "date").toString()));
	}

	public String setSingleSelect(String token, String projectId, String itemId, String fieldId, String optionId) {
		return updateField(token, projectId, itemId, fieldId, Map.of("singleSelectOptionId", require(optionId, "optionId")));
	}

	public String clearField(String token, String projectId, String itemId, String fieldId) {
		return text(post(token, """
				mutation($project: ID!, $item: ID!, $field: ID!) {
				  clearProjectV2ItemFieldValue(input: {projectId: $project, itemId: $item, fieldId: $field}) {
				    projectV2Item { id }
				  }
				}
				""", ids(projectId, itemId, fieldId)).path("clearProjectV2ItemFieldValue").path("projectV2Item"), "id");
	}

	/** Read authoritative values after writes/events; missing fields mean unset, not a failed request. */
	public ItemValues itemValues(String token, String itemId) {
		require(itemId, "itemId");
		Map<String, LocalDate> dates = new LinkedHashMap<>();
		Map<String, String> options = new LinkedHashMap<>();
		Set<String> cursors = new HashSet<>();
		String cursor = null;
		String projectId = null;
		String issueId = null;
		Instant itemVersion = null;
		boolean archived = false;
		do {
			Map<String, Object> variables = new LinkedHashMap<>();
			variables.put("item", itemId);
			variables.put("after", cursor);
			JsonNode node = post(token, """
					query($item: ID!, $after: String) {
					  node(id: $item) { ... on ProjectV2Item {
					    id isArchived updatedAt project { id } content { __typename ... on Issue { id } }
					    fieldValues(first: 100, after: $after) { nodes {
					      __typename
					      ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2Field { id } } }
					      ... on ProjectV2ItemFieldSingleSelectValue {
					        optionId field { ... on ProjectV2SingleSelectField { id } }
					      }
					    } pageInfo { hasNextPage endCursor } }
					  } }
					}
					""", variables).path("node");
			if (!itemId.equals(text(node, "id"))) throw invalid();
			if (!node.path("isArchived").isBoolean()) throw invalid();
			Instant currentVersion;
			try { currentVersion = Instant.parse(text(node, "updatedAt")); }
			catch (java.time.format.DateTimeParseException exception) { throw invalid(); }
			if (itemVersion != null && (!itemVersion.equals(currentVersion) || archived != node.path("isArchived").booleanValue())) throw invalid();
			itemVersion = currentVersion;
			archived = node.path("isArchived").booleanValue();
			String currentProject = text(node.path("project"), "id");
			JsonNode content = node.path("content");
			String currentIssue = "Issue".equals(content.path("__typename").asString()) ? text(content, "id") : null;
			if (projectId != null && (!projectId.equals(currentProject) || !Objects.equals(issueId, currentIssue))) throw invalid();
			projectId = currentProject;
			issueId = currentIssue;
			JsonNode connection = node.path("fieldValues");
			for (JsonNode value : array(connection, "nodes")) {
				String type = text(value, "__typename");
				if ("ProjectV2ItemFieldDateValue".equals(type) && !value.path("date").isNull()) {
					try { dates.put(text(value.path("field"), "id"), LocalDate.parse(text(value, "date"))); }
					catch (java.time.format.DateTimeParseException exception) { throw invalid(); }
				}
				if ("ProjectV2ItemFieldSingleSelectValue".equals(type) && !value.path("optionId").isNull()) {
					options.put(text(value.path("field"), "id"), text(value, "optionId"));
				}
			}
			cursor = nextCursor(connection, cursors);
		} while (cursor != null);
		return new ItemValues(itemId, projectId, issueId, Map.copyOf(dates), Map.copyOf(options), archived, itemVersion);
	}

	private String updateField(String token, String project, String item, String field, Map<String, String> value) {
		Map<String, Object> variables = ids(project, item, field);
		variables.put("value", value);
		return text(post(token, """
				mutation($project: ID!, $item: ID!, $field: ID!, $value: ProjectV2FieldValue!) {
				  updateProjectV2ItemFieldValue(input: {projectId: $project, itemId: $item, fieldId: $field, value: $value}) {
				    projectV2Item { id }
				  }
				}
				""", variables).path("updateProjectV2ItemFieldValue").path("projectV2Item"), "id");
	}

	private JsonNode post(String token, String query, Map<String, Object> variables) {
		return graphql.execute(token, query, variables);
	}

	private static Field field(JsonNode node) {
		List<Option> options = new ArrayList<>();
		if ("SINGLE_SELECT".equals(text(node, "dataType"))) {
			for (JsonNode option : array(node, "options")) options.add(new Option(text(option, "id"), text(option, "name")));
		}
		return new Field(text(node, "id"), text(node, "name"), text(node, "dataType"), List.copyOf(options));
	}

	private static String nextCursor(JsonNode connection, Set<String> seen) {
		JsonNode info = connection.path("pageInfo");
		if (!info.path("hasNextPage").isBoolean()) throw invalid();
		if (!info.path("hasNextPage").booleanValue()) return null;
		String next = text(info, "endCursor");
		if (!seen.add(next)) throw invalid();
		return next;
	}

	private static JsonNode array(JsonNode node, String key) {
		JsonNode value = node.path(key);
		if (!value.isArray()) throw invalid();
		return value;
	}

	private static String text(JsonNode node, String key) {
		JsonNode value = node.path(key);
		if (!value.isString() || value.stringValue().isBlank()) throw invalid();
		return value.stringValue();
	}

	private static Map<String, Object> ids(String project, String item, String field) {
		Map<String, Object> result = new LinkedHashMap<>();
		result.put("project", require(project, "projectId"));
		result.put("item", require(item, "itemId"));
		result.put("field", require(field, "fieldId"));
		return result;
	}

	private static String require(String value, String name) {
		if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
		return value;
	}

	private static GithubProjectsException invalid() { return new GithubProjectsException(GithubProjectsException.Kind.INVALID_RESPONSE, 0); }

	public record Project(String id, int number, String title) { }
	public record Option(String id, String name) { }
	public record Field(String id, String name, String dataType, List<Option> options) { }
	public record ItemValues(String itemId, String projectId, String issueNodeId,
			Map<String, LocalDate> dates, Map<String, String> selectedOptions, boolean archived, Instant updatedAt) { }
}
