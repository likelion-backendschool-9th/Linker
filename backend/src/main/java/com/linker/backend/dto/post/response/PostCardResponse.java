package com.linker.backend.dto.post.response;

import java.util.List;

import com.linker.backend.dto.recruit.response.AuthorBriefResponse;

public record PostCardResponse(
		long id,
		AuthorBriefResponse author,
		String intro,
		String coverUrl,
		String repoFullName,
		String language,
		List<String> tags,
		int likeCount,
		int commentCount,
		String createdAt,
		String editedAt,
		boolean repoAvailable
) {
}
