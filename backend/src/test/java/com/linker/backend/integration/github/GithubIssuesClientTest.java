package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

class GithubIssuesClientTest {
	private MockRestServiceServer server;
	private GithubIssuesClient client;
	private final ObjectMapper mapper = new ObjectMapper();
	private final List<JsonNode> sent = new ArrayList<>();

	@BeforeEach void setUp() {
		var builder = RestClient.builder(); server = MockRestServiceServer.bindTo(builder).build();
		client = new GithubIssuesClient(new GithubGraphqlClient("https://api.github.com", builder));
	}

	@Test void readsFull64BitIdentityAndCompleteRelations() {
		respond(GithubFixtures.load("issue"));
		var value = client.snapshot("fixture", GithubFixtures.context(), "I_100");
		assertThat(value.githubIssueId()).isEqualTo(4_000_000_000L);
		assertThat(value.assignees()).hasSize(1); assertThat(value.labels()).hasSize(1);
		assertThat(value.assignees().getFirst().userId()).isNull();
		server.verify();
	}

	@Test void paginatesLabelsWithoutDuplicatingFinishedAssignees() {
		ObjectNode first = (ObjectNode) mapper.readTree(GithubFixtures.load("issue"));
		((ObjectNode) first.path("data").path("node").path("labels").path("pageInfo"))
				.put("hasNextPage", true).put("endCursor", "next-label");
		respond(first.toString());
		respond(GithubFixtures.load("issue").replace("\"name\":\"bug\"", "\"name\":\"feature\""));
		var result = client.snapshot("fixture", GithubFixtures.context(), "I_100");
		assertThat(result.assignees()).hasSize(1); assertThat(result.labels()).hasSize(2);
		assertThat(sent.get(1).path("variables").path("usersPending").booleanValue()).isFalse();
		assertThat(sent.get(1).path("variables").path("labelsAfter").stringValue()).isEqualTo("next-label");
		server.verify();
	}

	@Test void rejectsSnapshotChangingWhileRelationsArePaged() {
		ObjectNode first = (ObjectNode) mapper.readTree(GithubFixtures.load("issue"));
		((ObjectNode) first.path("data").path("node").path("labels").path("pageInfo"))
				.put("hasNextPage", true).put("endCursor", "next-label");
		respond(first.toString()); respond(GithubFixtures.load("issue").replace("T00:00:00Z", "T00:00:01Z"));
		assertThatThrownBy(() -> client.snapshot("fixture", GithubFixtures.context(), "I_100")).isInstanceOf(GithubProjectsException.class);
		server.verify();
	}

	@Test void rejectsRepositoryMismatchAndMissingPrivateIssue() {
		respond(GithubFixtures.load("issue").replace("R_10", "R_OTHER"));
		assertThatThrownBy(() -> client.snapshot("fixture", GithubFixtures.context(), "I_100")).isInstanceOf(GithubProjectsException.class);
		server.verify();
	}

	@Test void resolvesCurrentItemRatherThanWebhookItemId() {
		respond(GithubFixtures.load("membership"));
		assertThat(client.currentProjectItem("fixture", GithubFixtures.context(), "I_100")).contains("PVTI_1");
		assertThat(sent.getFirst().path("query").stringValue()).contains("includeArchived: false");
		server.verify();
	}

	@Test void excludesArchivedAndUnlinkedProjectItems() {
		respond(GithubFixtures.load("membership").replace("\"isArchived\":false", "\"isArchived\":true"));
		assertThat(client.currentProjectItem("fixture", GithubFixtures.context(), "I_100")).isEmpty(); server.verify();
	}

	@Test void rejectsRepeatedMembershipCursor() {
		var value = GithubFixtures.load("membership").replace("\"hasNextPage\":false,\"endCursor\":null", "\"hasNextPage\":true,\"endCursor\":\"same\"")
				.replace("PVT_1", "PVT_OTHER");
		respond(value); respond(value);
		assertThatThrownBy(() -> client.currentProjectItem("fixture", GithubFixtures.context(), "I_100")).isInstanceOf(GithubProjectsException.class);
		server.verify();
	}

	@Test void rejectsBigIntOutsideSigned64BitRange() {
		respond(GithubFixtures.load("issue").replace("4000000000", "9223372036854775808"));
		assertThatThrownBy(() -> client.snapshot("fixture", GithubFixtures.context(), "I_100")).isInstanceOf(GithubProjectsException.class);
		server.verify();
	}

	private void respond(String body) {
		server.expect(requestTo("https://api.github.com/graphql")).andExpect(header("Authorization", "Bearer fixture"))
				.andExpect(request -> sent.add(mapper.readTree(((MockClientHttpRequest) request).getBodyAsString())))
				.andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
	}
}
