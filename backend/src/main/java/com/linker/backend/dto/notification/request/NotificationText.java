package com.linker.backend.dto.notification.request;

import java.util.LinkedHashMap;
import java.util.Map;

import com.linker.backend.global.config.PlanLimits;

import tools.jackson.databind.json.JsonMapper;

/**
 * Shared payload shape for {@link CreateNotificationCommand#payloadJson()}: the list title and the
 * optional second line (Policy UI copy). Every producer writes the same {@code title}/{@code body} keys
 * that the 18 list and push read.
 */
public final class NotificationText {

	private static final JsonMapper JSON = JsonMapper.builder().build();

	private NotificationText() {
	}

	/** {@code {"title": ..., "body": ...}}; a null or blank body is left out. */
	public static String json(String title, String body) {
		Map<String, Object> payload = new LinkedHashMap<>();
		payload.put("title", title);
		if (body != null && !body.isBlank()) {
			payload.put("body", body);
		}
		return JSON.writeValueAsString(payload);
	}

	/** User text as a one-line body: whitespace collapsed, first 100 characters + "…" (same rule as chat). */
	public static String preview(String text) {
		if (text == null) {
			return null;
		}
		String line = text.strip().replaceAll("\\s+", " ");
		if (line.isEmpty()) {
			return null;
		}
		int max = PlanLimits.CHAT_NOTIFICATION_PREVIEW_MAX_CHARS;
		if (line.codePointCount(0, line.length()) <= max) {
			return line;
		}
		return line.substring(0, line.offsetByCodePoints(0, max)) + "…";
	}
}
