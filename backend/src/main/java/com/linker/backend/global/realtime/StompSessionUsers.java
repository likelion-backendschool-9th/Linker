package com.linker.backend.global.realtime;

import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * Maps a live STOMP session to the account bound at CONNECT.
 * Broker copies do not carry the subscriber principal, so outbound checks use this map.
 */
@Component
public class StompSessionUsers {

	private final ConcurrentHashMap<String, Long> users = new ConcurrentHashMap<>();

	public void bind(String sessionId, long userId) {
		if (sessionId != null) {
			users.put(sessionId, userId);
		}
	}

	public void unbind(String sessionId) {
		if (sessionId != null) {
			users.remove(sessionId);
		}
	}

	public Long userId(String sessionId) {
		return sessionId == null ? null : users.get(sessionId);
	}
}
