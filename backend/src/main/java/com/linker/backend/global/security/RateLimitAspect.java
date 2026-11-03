package com.linker.backend.global.security;

import java.util.Map;

import com.linker.backend.global.error.ApiException;

import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class RateLimitAspect {

	private static final Logger log = LoggerFactory.getLogger(RateLimitAspect.class);

	private final RedisRateLimiter limiter;

	public RateLimitAspect(RedisRateLimiter limiter) {
		this.limiter = limiter;
	}

	@Before("@annotation(rateLimit)")
	public void check(RateLimit rateLimit) {
		AuthenticatedUser user = CurrentUser.require();
		try {
			RedisRateLimiter.Decision decision = limiter.tryAcquire(
					rateLimit.key(),
					user.userId(),
					rateLimit.permits(),
					rateLimit.windowSeconds()
			);
			if (!decision.allowed()) {
				throw new ApiException(
						429,
						"RATE_LIMITED",
						"요청이 너무 많아요. 잠시 후 다시 시도해 주세요",
						Map.of("retryAfterSeconds", decision.retryAfterSeconds())
				);
			}
		}
		catch (ApiException exception) {
			throw exception;
		}
		catch (RuntimeException exception) {
			log.warn("rate limit unavailable: {}", exception.getClass().getSimpleName());
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "잠시 후 다시 시도해 주세요");
		}
	}
}
