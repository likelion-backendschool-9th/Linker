package com.linker.backend.async.webhook;

import java.util.Optional;

import com.linker.backend.global.config.LinkerProperties;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RedisWebhookQueue implements WebhookQueue {

	private final StringRedisTemplate redis;
	private final String key;

	public RedisWebhookQueue(StringRedisTemplate redis, LinkerProperties properties) {
		this.redis = redis;
		this.key = properties.webhook().queueKey();
	}

	@Override
	public void enqueue(long deliveryRowId) {
		redis.opsForList().rightPush(key, Long.toString(deliveryRowId));
	}

	@Override
	public Optional<Long> poll() {
		String value = redis.opsForList().leftPop(key);
		if (value == null) {
			return Optional.empty();
		}
		return Optional.of(Long.valueOf(value));
	}
}
