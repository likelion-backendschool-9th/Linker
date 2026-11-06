package com.linker.backend.dto.post.response;

import com.linker.backend.dto.recruit.response.AuthorBriefResponse;

public record CommentResponse(
		long id,
		long postId,
		Long parentId,
		AuthorBriefResponse author,
		String text,
		boolean deleted,
		String createdAt,
		String editedAt
) {
}
