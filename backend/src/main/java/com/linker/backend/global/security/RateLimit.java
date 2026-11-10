package com.linker.backend.global.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Redis-backed per-user rate limit for authenticated controller methods.
 * Key shape: {@code rate:{key}:{userId}}.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {

	/** Logical bucket name, e.g. {@code chat.send} or {@code share.create}. */
	String key();

	/** Allowed calls inside {@link #windowSeconds()}. */
	int permits();

	/** Sliding fixed window length in seconds. */
	int windowSeconds();
}
