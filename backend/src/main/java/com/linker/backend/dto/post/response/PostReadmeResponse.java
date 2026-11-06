package com.linker.backend.dto.post.response;

public record PostReadmeResponse(
		String repo,
		String markdown,
		String cachedAt
) {
}
