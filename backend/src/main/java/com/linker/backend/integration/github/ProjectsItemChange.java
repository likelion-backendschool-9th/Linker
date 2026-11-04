package com.linker.backend.integration.github;

import java.time.Instant;
import java.util.Optional;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Parsed event is a refresh hint, never authorization or an instruction to blindly overwrite cache. */
public record ProjectsItemChange(String action, long installationId, long organizationId,
		String projectId, String itemId, String issueNodeId, Instant updatedAt) {

	/** Call only after B's signature/envelope verification. PR/draft items are outside the issue cache. */
	public static Optional<ProjectsItemChange> parse(String payload, ObjectMapper mapper) {
		try {
			JsonNode root = mapper.readTree(payload);
			if (root == null || !root.isObject()) throw invalid();
			String action = text(root, "action");
			long installation = positive(root.path("installation"), "id");
			long organization = positive(root.path("organization"), "id");
			JsonNode item = root.path("projects_v2_item");
			String type = text(item, "content_type");
			if ("PullRequest".equals(type) || "DraftIssue".equals(type)) return Optional.empty();
			if (!"Issue".equals(type)) throw invalid();
			return Optional.of(new ProjectsItemChange(action, installation, organization,
					text(item, "project_node_id"), text(item, "node_id"), text(item, "content_node_id"),
					Instant.parse(text(item, "updated_at"))));
		}
		catch (RuntimeException exception) {
			// Payload can contain private text. Never retain it in exception text or as a cause.
			throw invalid();
		}
	}

	private static long positive(JsonNode node, String key) {
		JsonNode value = node.path(key);
		if (!value.isIntegralNumber() || value.longValue() <= 0) throw invalid();
		return value.longValue();
	}

	private static String text(JsonNode node, String key) {
		JsonNode value = node.path(key);
		if (!value.isString() || value.stringValue().isBlank()) throw invalid();
		return value.stringValue();
	}

	private static IllegalArgumentException invalid() {
		return new IllegalArgumentException("Invalid projects_v2_item payload");
	}
}
