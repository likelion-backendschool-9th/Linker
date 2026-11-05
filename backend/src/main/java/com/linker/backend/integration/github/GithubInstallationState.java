package com.linker.backend.integration.github;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/** Server-side, single-use state, bound to both account and login session. */
@Component
public class GithubInstallationState {
	private static final SecureRandom RANDOM = new SecureRandom();
	private static final DefaultRedisScript<Long> CONSUME = new DefaultRedisScript<>("""
			if redis.call('GET', KEYS[1]) == ARGV[1] then
			  return redis.call('DEL', KEYS[1])
			end
			return 0
			""", Long.class);
	private final StringRedisTemplate redis;
	private final GithubAppProperties properties;

	public GithubInstallationState(StringRedisTemplate redis, GithubAppProperties properties) {
		this.redis = redis;
		this.properties = properties;
	}

	public String issue(long userId, long sessionId) {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		try {
			redis.opsForValue().set(key(state), binding(userId, sessionId), properties.stateTtl());
		}
		catch (DataAccessException exception) { throw unavailable(); }
		return state;
	}

	public void consume(String state, long userId, long sessionId) {
		if (state == null || !state.matches("[A-Za-z0-9_-]{43}")) {
			throw invalid();
		}
		Long consumed;
		try {
			consumed = redis.execute(CONSUME, List.of(key(state)), binding(userId, sessionId));
		}
		catch (DataAccessException exception) { throw unavailable(); }
		if (consumed == null || consumed != 1) {
			throw invalid();
		}
	}

	private String binding(long userId, long sessionId) { return userId + ":" + sessionId; }

	private String key(String state) {
		try {
			byte[] hash = MessageDigest.getInstance("SHA-256").digest(state.getBytes(StandardCharsets.UTF_8));
			return "linker:github:install-state:" + HexFormat.of().formatHex(hash);
		}
		catch (java.security.NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 unavailable");
		}
	}

	private ApiException invalid() { return new ApiException(400, "VALIDATION_ERROR", "설치 요청이 만료됐거나 올바르지 않아요. 다시 시작해 주세요"); }
	private ApiException unavailable() { return new ApiException(503, "SERVICE_UNAVAILABLE", "잠시 후 다시 시도해 주세요"); }
}
