package com.linker.backend.integration.github;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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

/** One-time login state. The key prefix is separate from installation state. */
@Component
public class GithubLoginState {

	private static final SecureRandom RANDOM = new SecureRandom();
	private static final DefaultRedisScript<String> CONSUME = new DefaultRedisScript<>("""
			local value = redis.call('GET', KEYS[1])
			if value then
			  redis.call('DEL', KEYS[1])
			end
			return value
			""", String.class);

	private final StringRedisTemplate redis;
	private final GithubAppProperties properties;

	public GithubLoginState(StringRedisTemplate redis, GithubAppProperties properties) {
		this.redis = redis;
		this.properties = properties;
	}

	public String issue(String client, String returnTo, String redirectUri) {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		try {
			redis.opsForValue().set(key(state), client + "\n" + returnTo + "\n" + redirectUri, properties.stateTtl());
		}
		catch (DataAccessException exception) {
			throw unavailable();
		}
		return state;
	}

	public Pending consume(String state) {
		if (state == null || !state.matches("[A-Za-z0-9_-]{43}")) {
			throw invalid();
		}
		String value;
		try {
			value = redis.execute(CONSUME, List.of(key(state)));
		}
		catch (DataAccessException exception) {
			throw unavailable();
		}
		if (value == null) {
			throw invalid();
		}
		String[] parts = value.split("\n", 3);
		if (parts.length != 3 || parts[0].isBlank() || parts[2].isBlank()) {
			throw invalid();
		}
		return new Pending(parts[0], parts[1], parts[2]);
	}

	private String key(String state) {
		try {
			byte[] hash = MessageDigest.getInstance("SHA-256").digest(state.getBytes(StandardCharsets.UTF_8));
			return "linker:github:login-state:" + HexFormat.of().formatHex(hash);
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 unavailable");
		}
	}

	private static ApiException invalid() {
		return new ApiException(400, "VALIDATION_ERROR", "로그인을 완료하지 못했어요. 다시 시도해 주세요.");
	}

	private static ApiException unavailable() {
		return new ApiException(503, "SERVICE_UNAVAILABLE", "잠시 후 다시 시도해 주세요");
	}

	public record Pending(String client, String returnTo, String redirectUri) {
	}
}
