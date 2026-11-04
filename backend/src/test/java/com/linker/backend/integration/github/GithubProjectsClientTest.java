package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.SocketTimeoutException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class GithubProjectsClientTest {

	private static final String TOKEN = "fixture-token-not-a-real-credential";
	private MockRestServiceServer server;
	private GithubProjectsClient client;
	private final List<JsonNode> requests = new ArrayList<>();
	private final ObjectMapper mapper = new ObjectMapper();

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder();
		server = MockRestServiceServer.bindTo(builder).build();
		client = new GithubProjectsClient("https://api.github.com", builder);
	}

	@Test
	void createsProjectWithVariablesRatherThanInterpolatingTitle() {
		respond("""
				{"data":{"createProjectV2":{"projectV2":{"id":"PVT_1","number":7,"title":"Linker"}}}}
				""");
		var result = client.createProject(TOKEN, "O_1", "Linker \"trial\"");
		assertThat(result.id()).isEqualTo("PVT_1");
		assertThat(result.number()).isEqualTo(7);
		assertThat(requests.getFirst().path("variables").path("owner").stringValue()).isEqualTo("O_1");
		assertThat(requests.getFirst().path("variables").path("title").stringValue()).isEqualTo("Linker \"trial\"");
		assertThat(requests.getFirst().path("query").stringValue()).doesNotContain("trial");
		server.verify();
	}

	@Test
	void readsStatusOptionIdsAndDateFieldsAcrossPages() {
		respond(fields("""
				{"id":"STATUS","name":"상태","dataType":"SINGLE_SELECT","options":[
				{"id":"blocked-id","name":"중단"},{"id":"other-id","name":"Review"}]}
				""", true, "cursor-1"));
		respond(fields("""
				{"id":"START","name":"시작일","dataType":"DATE"},
				{"id":"DUE","name":"마감일","dataType":"DATE"}
				""", false, null));
		var result = client.fields(TOKEN, "PVT_1");
		assertThat(result).hasSize(3);
		assertThat(result.getFirst().options()).extracting(GithubProjectsClient.Option::id)
				.containsExactly("blocked-id", "other-id");
		assertThat(requests.get(0).path("variables").path("after").isNull()).isTrue();
		assertThat(requests.get(1).path("variables").path("after").stringValue()).isEqualTo("cursor-1");
		server.verify();
	}

	@Test
	void rejectsRepeatedPaginationCursorInsteadOfLooping() {
		respond(fields("", true, "same"));
		respond(fields("", true, "same"));
		assertInvalid(() -> client.fields(TOKEN, "PVT_1"));
		server.verify();
	}

	@Test
	void rejectsTruncatedFieldConnection() {
		respond("{\"data\":{\"node\":{\"fields\":{\"nodes\":[]}}}}");
		assertInvalid(() -> client.fields(TOKEN, "PVT_1"));
		server.verify();
	}

	@Test
	void createsMissingDateField() {
		respond("""
				{"data":{"createProjectV2Field":{"projectV2Field":{"id":"DUE","name":"Due date","dataType":"DATE"}}}}
				""");
		assertThat(client.createDateField(TOKEN, "PVT_1", "Due date").id()).isEqualTo("DUE");
		assertThat(requests.getFirst().path("query").stringValue()).contains("dataType: DATE");
		server.verify();
	}

	@Test
	void addsExistingIssueRatherThanCreatingLinkerOnlyIssue() {
		respond("{\"data\":{\"addProjectV2ItemById\":{\"item\":{\"id\":\"PVTI_1\"}}}}");
		assertThat(client.addIssue(TOKEN, "PVT_1", "I_1")).isEqualTo("PVTI_1");
		assertThat(requests.getFirst().path("variables").path("issue").stringValue()).isEqualTo("I_1");
		server.verify();
	}

	@Test
	void writesDateWithoutConvertingCalendarDayToUtc() {
		respond(updated());
		assertThat(client.setDate(TOKEN, "PVT_1", "PVTI_1", "DUE", LocalDate.of(2026, 11, 4))).isEqualTo("PVTI_1");
		JsonNode value = requests.getFirst().path("variables").path("value");
		assertThat(value.size()).isEqualTo(1);
		assertThat(value.path("date").stringValue()).isEqualTo("2026-11-04");
		server.verify();
	}

	@Test
	void writesBlockedUsingMappedOptionIdNotDisplayName() {
		respond(updated());
		client.setSingleSelect(TOKEN, "PVT_1", "PVTI_1", "STATUS", "blocked-option");
		JsonNode value = requests.getFirst().path("variables").path("value");
		assertThat(value.size()).isEqualTo(1);
		assertThat(value.path("singleSelectOptionId").stringValue()).isEqualTo("blocked-option");
		server.verify();
	}

	@Test
	void clearsDateThroughDedicatedMutation() {
		respond("{\"data\":{\"clearProjectV2ItemFieldValue\":{\"projectV2Item\":{\"id\":\"PVTI_1\"}}}}");
		assertThat(client.clearField(TOKEN, "PVT_1", "PVTI_1", "DUE")).isEqualTo("PVTI_1");
		assertThat(requests.getFirst().path("query").stringValue()).contains("clearProjectV2ItemFieldValue");
		assertThat(requests.getFirst().path("variables").has("value")).isFalse();
		server.verify();
	}

	@Test
	void readsAuthoritativeItemValuesAcrossPagesIncludingUnsetDate() {
		respond(item("""
				{"__typename":"ProjectV2ItemFieldDateValue","date":"2026-11-04","field":{"id":"START"}},
				{"__typename":"ProjectV2ItemFieldDateValue","date":null,"field":{"id":"DUE"}}
				""", true, "next-values"));
		respond(item("""
				{"__typename":"ProjectV2ItemFieldSingleSelectValue","optionId":"blocked-id","field":{"id":"STATUS"}},
				{"__typename":"ProjectV2ItemFieldTextValue"}
				""", false, null));
		var result = client.itemValues(TOKEN, "PVTI_1");
		assertThat(result.issueNodeId()).isEqualTo("I_1");
		assertThat(result.projectId()).isEqualTo("PVT_1");
		assertThat(result.dates()).containsEntry("START", LocalDate.of(2026, 11, 4)).doesNotContainKey("DUE");
		assertThat(result.selectedOptions()).containsEntry("STATUS", "blocked-id");
		server.verify();
	}

	@Test
	void rejectsMissingItemAndInvalidDateInsteadOfReturningEmptySuccess() {
		respond("{\"data\":{\"node\":null}}");
		assertInvalid(() -> client.itemValues(TOKEN, "PVTI_1"));
		server.verify();
	}

	@Test
	void rejectsPartialGraphqlSuccessWithoutLeakingErrorBody() {
		respond("""
				{"data":{"createProjectV2":{"projectV2":{"id":"PVT_1","number":1,"title":"Linker"}}},
				 "errors":[{"message":"private title and fixture-token-not-a-real-credential"}]}
				""");
		assertThatThrownBy(() -> client.createProject(TOKEN, "O_1", "Linker"))
				.isInstanceOfSatisfying(GithubProjectsException.class, ex -> {
					assertThat(ex.kind()).isEqualTo(GithubProjectsException.Kind.GRAPHQL_ERROR);
					assertThat(ex.getMessage()).doesNotContain("private title", TOKEN);
					assertThat(ex.getCause()).isNull();
				});
		server.verify();
	}

	@Test
	void returnsPermissionFailureWithoutRetryingWriteOrLeakingBody() {
		server.expect(requestTo("https://api.github.com/graphql"))
				.andRespond(withStatus(HttpStatus.FORBIDDEN).body("private data " + TOKEN));
		assertThatThrownBy(() -> client.createProject(TOKEN, "O_1", "Linker"))
				.isInstanceOfSatisfying(GithubProjectsException.class, ex -> {
					assertThat(ex.kind()).isEqualTo(GithubProjectsException.Kind.HTTP_ERROR);
					assertThat(ex.httpStatus()).isEqualTo(403);
					assertThat(ex.getMessage()).doesNotContain(TOKEN, "private data");
				});
		server.verify();
	}

	@Test
	void reportsTransportFailureWithoutAutomaticallyDuplicatingMutation() {
		server.expect(requestTo("https://api.github.com/graphql"))
				.andRespond(withException(new SocketTimeoutException("private transport details")));
		assertThatThrownBy(() -> client.createProject(TOKEN, "O_1", "Linker"))
				.isInstanceOfSatisfying(GithubProjectsException.class, ex -> {
					assertThat(ex.kind()).isEqualTo(GithubProjectsException.Kind.TRANSPORT_ERROR);
					assertThat(ex.getMessage()).doesNotContain("private transport details");
				});
		server.verify();
	}

	@Test
	void rejectsEmptyTokenBeforeAnyHttpRequest() {
		assertThatThrownBy(() -> client.createProject(" ", "O_1", "Linker")).isInstanceOf(IllegalArgumentException.class);
		server.verify();
	}

	@Test
	void rejectsInvalidJsonAndMissingData() {
		respond("not json");
		assertInvalid(() -> client.fields(TOKEN, "PVT_1"));
		server.verify();
	}

	private void respond(String json) {
		server.expect(requestTo("https://api.github.com/graphql"))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("Authorization", "Bearer " + TOKEN))
				.andExpect(request -> requests.add(mapper.readTree(((MockClientHttpRequest) request).getBodyAsString())))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
	}

	private static String fields(String nodes, boolean more, String cursor) {
		return "{\"data\":{\"node\":{\"fields\":{\"nodes\":[" + nodes + "],\"pageInfo\":" + pageInfo(more, cursor) + "}}}}";
	}

	private static String item(String nodes, boolean more, String cursor) {
		return "{\"data\":{\"node\":{\"id\":\"PVTI_1\",\"isArchived\":false,\"updatedAt\":\"2026-11-04T00:00:00Z\",\"project\":{\"id\":\"PVT_1\"},"
				+ "\"content\":{\"__typename\":\"Issue\",\"id\":\"I_1\"},\"fieldValues\":{\"nodes\":[" + nodes
				+ "],\"pageInfo\":" + pageInfo(more, cursor) + "}}}}";
	}

	private static String pageInfo(boolean more, String cursor) {
		return "{\"hasNextPage\":" + more + ",\"endCursor\":" + (cursor == null ? "null" : "\"" + cursor + "\"") + "}";
	}

	private static String updated() {
		return "{\"data\":{\"updateProjectV2ItemFieldValue\":{\"projectV2Item\":{\"id\":\"PVTI_1\"}}}}";
	}

	private static void assertInvalid(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
		assertThatThrownBy(call).isInstanceOfSatisfying(GithubProjectsException.class,
				ex -> assertThat(ex.kind()).isEqualTo(GithubProjectsException.Kind.INVALID_RESPONSE));
	}
}
