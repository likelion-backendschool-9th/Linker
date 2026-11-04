package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ProjectsItemChangeTest {

	private final ObjectMapper mapper = new ObjectMapper();

	@Test
	void readsRefreshIdentityWithoutDependingOnFieldValueDiff() {
		var event = ProjectsItemChange.parse(payload("Issue"), mapper).orElseThrow();
		assertThat(event.action()).isEqualTo("edited");
		assertThat(event.installationId()).isEqualTo(100);
		assertThat(event.organizationId()).isEqualTo(200);
		assertThat(event.projectId()).isEqualTo("PVT_1");
		assertThat(event.itemId()).isEqualTo("PVTI_1");
		assertThat(event.issueNodeId()).isEqualTo("I_1");
		assertThat(event.updatedAt()).isEqualTo(Instant.parse("2026-11-04T01:00:00Z"));
	}

	@Test
	void ignoresPullRequestAndDraftIssueForTheIssueCache() {
		assertThat(ProjectsItemChange.parse(payload("PullRequest"), mapper)).isEmpty();
		assertThat(ProjectsItemChange.parse(payload("DraftIssue"), mapper)).isEmpty();
	}

	@Test
	void requiresInstallationAndOrganizationIdentity() {
		assertInvalid(payload("Issue").replace("\"installation\":{\"id\":100},", ""));
		assertInvalid(payload("Issue").replace("\"id\":200", "\"id\":0"));
	}

	@Test
	void rejectsMissingIdentityAndInvalidTimestamp() {
		assertInvalid(payload("Issue").replace("\"project_node_id\":\"PVT_1\",", ""));
		assertInvalid(payload("Issue").replace("2026-11-04T01:00:00Z", "not-a-date"));
	}

	@Test
	void doesNotLeakInvalidPayloadInException() {
		assertThatThrownBy(() -> ProjectsItemChange.parse("private-body invalid-json", mapper))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessage("Invalid projects_v2_item payload")
				.hasNoCause();
	}

	private void assertInvalid(String payload) {
		assertThatThrownBy(() -> ProjectsItemChange.parse(payload, mapper)).isInstanceOf(IllegalArgumentException.class);
	}

	private static String payload(String contentType) {
		return """
				{"action":"edited","installation":{"id":100},"organization":{"id":200},
				 "projects_v2_item":{"node_id":"PVTI_1","project_node_id":"PVT_1",
				 "content_node_id":"I_1","content_type":"%s","updated_at":"2026-11-04T01:00:00Z"},
				 "changes":{"field_value":{"field_node_id":"DUE"}}}
				""".formatted(contentType);
	}
}
