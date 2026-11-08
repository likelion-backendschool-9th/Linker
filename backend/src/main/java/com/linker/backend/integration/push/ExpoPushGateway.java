package com.linker.backend.integration.push;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import tools.jackson.databind.JsonNode;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Technical adapter for Android Expo push delivery. */
@Component
public class ExpoPushGateway implements PushGateway {

	private static final Logger log = LoggerFactory.getLogger(ExpoPushGateway.class);
	private static final String ENDPOINT = "https://exp.host/--/api/v2/push/send";

	private final RestClient client;
	public ExpoPushGateway() {
		this.client = RestClient.builder().baseUrl(ENDPOINT).build();
	}

	@Override
	public Set<String> send(List<PushMessage> messages) {
		if (messages.isEmpty()) {
			return Set.of();
		}
		List<Map<String, Object>> body = new ArrayList<>();
		for (PushMessage message : messages) {
			Map<String, Object> item = new java.util.HashMap<>();
			item.put("to", message.token());
			item.put("title", message.title());
			item.put("body", message.body());
			Map<String, Object> data = new java.util.HashMap<>();
			if (message.data() != null) data.putAll(message.data());
			// B's app consumes data.path; preserve D's notification metadata and existing linkPath.
			if (message.linkPath() != null && !message.linkPath().isBlank()) data.put("path", message.linkPath());
			if (!data.isEmpty()) item.put("data", data);
			body.add(item);
		}
		try {
			JsonNode response = client.post().body(body).retrieve().body(JsonNode.class);
			Set<String> successful = new HashSet<>();
			JsonNode tickets = response == null ? null : response.get("data");
			if (tickets != null && tickets.isArray()) {
				for (int i = 0; i < tickets.size() && i < messages.size(); i++) {
					if ("ok".equals(tickets.get(i).path("status").asText())) successful.add(messages.get(i).token());
				}
			}
			return successful;
		}
		catch (RuntimeException exception) {
			log.warn("Expo push delivery failed: {}", exception.getClass().getSimpleName());
			return Set.of();
		}
	}
}
