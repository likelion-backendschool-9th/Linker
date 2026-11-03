package com.linker.backend.global.security;

import java.util.List;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
public class RedisRateLimiter {

	private static final DefaultRedisScript<Long> SCRIPT = new DefaultRedisScript<>("""
			local current = redis.call('INCR', KEYS[1])
			if current == 1 or redis.call('TTL', KEYS[1]) < 0 then
			  redis.call('EXPIRE', KEYS[1], ARGV[1])
			end
			return current
			""", Long.class);

	private final StringRedisTemplate redis;

	public RedisRateLimiter(StringRedisTemplate redis) {
		this.redis = redis;
	}

	public Decision tryAcquire(String bucket, long userId, int permits, int windowSeconds) {
		String key = "rate:" + bucket + ":" + userId;
		Long count = redis.execute(SCRIPT, List.of(key), Integer.toString(windowSeconds));
		if (count == null || count <= permits) {
			return new Decision(true, 0);
		}
		Long ttl = redis.getExpire(key);
		long retryAfter = ttl == null || ttl < 1 ? windowSeconds : ttl;
		return new Decision(false, retryAfter);
	}

	public record Decision(boolean allowed, long retryAfterSeconds) {
	}
}
