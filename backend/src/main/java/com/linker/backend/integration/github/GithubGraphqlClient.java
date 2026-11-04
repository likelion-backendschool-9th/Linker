package com.linker.backend.integration.github;

import java.util.Map;

import tools.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Shared transport. Never logs upstream bodies, credentials or query variables. */
public class GithubGraphqlClient {

	private final RestClient client;

	public GithubGraphqlClient(String baseUrl, RestClient.Builder builder) {
		if (baseUrl == null || baseUrl.isBlank()) throw new IllegalArgumentException("GitHub base URL is required");
		client = builder.baseUrl(baseUrl).defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
				.defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).defaultHeader("User-Agent", "Linker").build();
	}

	public JsonNode execute(String token, String query, Map<String, Object> variables) {
		if (token == null || token.isBlank()) throw new IllegalArgumentException("GitHub access token is required");
		JsonNode response;
		try {
			response = client.post().uri("/graphql").headers(headers -> headers.setBearerAuth(token))
					.body(Map.of("query", query, "variables", variables)).retrieve()
					.onStatus(status -> status.isError(), (request, reply) -> {
						throw new GithubProjectsException(GithubProjectsException.Kind.HTTP_ERROR, reply.getStatusCode().value());
					}).body(JsonNode.class);
		} catch (ResourceAccessException exception) {
			throw new GithubProjectsException(GithubProjectsException.Kind.TRANSPORT_ERROR, 0);
		} catch (RestClientException exception) { throw invalid(); }
		if (response == null || !response.isObject()) throw invalid();
		JsonNode errors = response.get("errors");
		if (errors != null && !errors.isNull() && (!errors.isArray() || !errors.isEmpty())) {
			throw new GithubProjectsException(GithubProjectsException.Kind.GRAPHQL_ERROR, 200);
		}
		JsonNode data = response.get("data");
		if (data == null || !data.isObject()) throw invalid();
		return data;
	}

	static JsonNode array(JsonNode node, String key) {
		JsonNode value = node.path(key);
		if (!value.isArray()) throw invalid();
		return value;
	}

	static String text(JsonNode node, String key) {
		JsonNode value = node.path(key);
		if (!value.isString() || value.stringValue().isBlank()) throw invalid();
		return value.stringValue();
	}

	static GithubProjectsException invalid() { return new GithubProjectsException(GithubProjectsException.Kind.INVALID_RESPONSE, 0); }
}
