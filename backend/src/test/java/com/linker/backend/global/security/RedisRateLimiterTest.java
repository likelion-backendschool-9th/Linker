package com.linker.backend.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

@ExtendWith(MockitoExtension.class)
class RedisRateLimiterTest {

	@Mock
	StringRedisTemplate redis;

	@Test
	void allowsUntilPermitsThenBlocks() {
		RedisRateLimiter limiter = new RedisRateLimiter(redis);
		when(redis.execute(any(RedisScript.class), anyList(), any(Object[].class)))
				.thenReturn(1L, 2L, 3L);
		when(redis.getExpire(anyString())).thenReturn(1L);

		assertThat(limiter.tryAcquire("chat.send", 7L, 2, 1).allowed()).isTrue();
		assertThat(limiter.tryAcquire("chat.send", 7L, 2, 1).allowed()).isTrue();
		RedisRateLimiter.Decision blocked = limiter.tryAcquire("chat.send", 7L, 2, 1);
		assertThat(blocked.allowed()).isFalse();
		assertThat(blocked.retryAfterSeconds()).isEqualTo(1L);
	}
}
