package com.linker.backend.global.security;

import java.util.List;

import com.linker.backend.global.config.LinkerProperties;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
public class PublicReadRateLimiter {

	private static final DefaultRedisScript<Long> SCRIPT = new DefaultRedisScript<>("""
			local current = redis.call('INCR', KEYS[1])
			if current == 1 or redis.call('TTL', KEYS[1]) < 0 then
			  redis.call('EXPIRE', KEYS[1], ARGV[1])
			end
			return current
			""", Long.class);

	private final StringRedisTemplate redis;
	private final int limit;

	public PublicReadRateLimiter(StringRedisTemplate redis, LinkerProperties properties) {
		this.redis = redis;
		this.limit = properties.security().publicReadPerMinute();
	}

	public Decision decide(String ip) {
		String key = "rate:public:" + ip;
		Long count = redis.execute(SCRIPT, List.of(key), "60");
		if (count == null || count <= limit) {
			return new Decision(true, 0);
		}
		Long ttl = redis.getExpire(key);
		long retryAfter = ttl == null || ttl < 1 ? 60 : ttl;
		return new Decision(false, retryAfter);
	}

	public record Decision(boolean allowed, long retryAfterSeconds) {
	}
}
