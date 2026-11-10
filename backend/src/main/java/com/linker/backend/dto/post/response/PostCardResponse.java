package com.linker.backend.dto.post.response;

import java.util.List;

import com.linker.backend.dto.recruit.response.AuthorBriefResponse;

public record PostCardResponse(
		long id,
		AuthorBriefResponse author,
		String intro,
		/** Body preview for feed cards; null when empty. */
		String excerpt,
		String coverUrl,
		String repoFullName,
		String language,
		List<String> tags,
		int likeCount,
		/** False for guests. */
		boolean likedByMe,
		int commentCount,
		String createdAt,
		String editedAt,
		boolean repoAvailable
) {
}
